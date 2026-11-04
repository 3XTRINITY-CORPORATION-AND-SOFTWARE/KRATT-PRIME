import test from "node:test";
import assert from "node:assert/strict";
import { KRATT_SCHEMA_VERSION } from "../../../packages/kratt-core/src/contracts.mjs";
import { evaluatePolicy } from "../../../packages/kratt-core/src/policy.mjs";
import { createKrattTelegramDispatcher } from "../src/adapters/kratt-policy-dispatcher.mjs";

const at = "2026-11-04T14:00:00Z";
const now = Date.parse(at);
const update = { update_id: 42, message: { message_id: 9 } };

function makeRuntime() {
  return Object.freeze({
    evaluate: (task, evidence, trustedContext, options = {}) =>
      evaluatePolicy(task, evidence, trustedContext, {
        ...options,
        now,
        verifyEvidence: () => false
      })
  });
}

function makeTask(action, eventId = "42") {
  return {
    schema_version: KRATT_SCHEMA_VERSION,
    task_id: `telegram-${eventId}`,
    actor: "telegram-webhook",
    action,
    target: { resource_type: "telegram_update", resource_id: eventId },
    constraints: { provider: "telegram", event_id: eventId },
    required_evidence: [],
    created_at: at,
    requested_authority: ["telegram.read"],
    status: "PENDING"
  };
}

function makeContext(action, eventId, sideEffectClass = "READ_ONLY") {
  return {
    schema_version: KRATT_SCHEMA_VERSION,
    authorities: ["telegram.read"],
    allowed_targets: [{ resource_type: "telegram_update", resource_id: eventId }],
    policies: [{
      action,
      required_authority: "telegram.read",
      target_types: ["telegram_update"],
      side_effect_class: sideEffectClass,
      ...(sideEffectClass === "EXTERNAL_WRITE"
        ? { approval_required: true, approval_authority: "telegram.approve" }
        : {})
    }],
    evaluated_at: at
  };
}

function dependencies({ action = "telegram.message.process", sideEffectClass = "READ_ONLY", auditResult = true } = {}) {
  const runtime = makeRuntime();
  const records = [];
  const executions = [];
  const dispatcher = createKrattTelegramDispatcher({
    authorizationRuntime: runtime,
    buildTask: ({ eventId }) => makeTask(action, eventId),
    getTrustedContext: ({ eventId }) => makeContext(action, eventId, sideEffectClass),
    getEvidence: async () => [],
    execute: async input => { executions.push(input); return { delivered: true }; },
    audit: { record: async entry => { records.push(entry); return auditResult; } }
  });
  return { dispatcher, records, executions };
}

test("Telegram event passes through the KRATT policy evaluator before execution", async () => {
  const { dispatcher, records, executions } = dependencies();
  const result = await dispatcher({ update, eventId: "42", eventType: "message" });
  assert.equal(result.ok, true);
  assert.equal(result.executed, true);
  assert.equal(executions.length, 1);
  assert.equal(executions[0].idempotencyKey, "42");
  assert.deepEqual(records.map(record => record.phase), [
    "POLICY_DECISION", "EXECUTION_INTENT", "EXECUTION_SUCCEEDED"
  ]);
});

test("external-write Telegram event is denied without evidence and signed approval", async () => {
  const { dispatcher, records, executions } = dependencies({
    action: "telegram.payment.refund",
    sideEffectClass: "EXTERNAL_WRITE"
  });
  const result = await dispatcher({ update, eventId: "42", eventType: "message" });
  assert.equal(result.executed, false);
  assert.equal(result.decision.decision, "DENY");
  assert.equal(executions.length, 0);
  assert.deepEqual(records.map(record => record.phase), ["POLICY_DECISION"]);
});

test("event ID and event type must match the Telegram update envelope", async () => {
  const { dispatcher, executions } = dependencies();
  await assert.rejects(
    dispatcher({ update, eventId: "43", eventType: "message" }),
    /EVENT_BINDING_INVALID/
  );
  await assert.rejects(
    dispatcher({ update, eventId: "42", eventType: "callback_query" }),
    /EVENT_BINDING_INVALID/
  );
  assert.equal(executions.length, 0);
});

test("KRATT task must be bound to Telegram provider and event ID", async () => {
  const runtime = makeRuntime();
  const dispatcher = createKrattTelegramDispatcher({
    authorizationRuntime: runtime,
    buildTask: () => makeTask("telegram.message.process", "different-id"),
    getTrustedContext: async () => makeContext("telegram.message.process", "42"),
    getEvidence: async () => [],
    execute: async () => { throw new Error("must not execute"); },
    audit: { record: async () => true }
  });
  await assert.rejects(
    dispatcher({ update, eventId: "42", eventType: "message" }),
    /TASK_BINDING_INVALID/
  );
});

test("audit failure blocks execution before side effects", async () => {
  const { dispatcher, executions } = dependencies({ auditResult: false });
  await assert.rejects(
    dispatcher({ update, eventId: "42", eventType: "message" }),
    /AUDIT_WRITE_FAILED/
  );
  assert.equal(executions.length, 0);
});

test("webhook handler and KRATT dispatcher compose into one authorized event path", async () => {
  const { dispatcher, executions } = dependencies();
  let completed = false;
  const { createTelegramWebhookHandler } = await import("../src/adapters/webhook-handler.mjs");
  const handler = createTelegramWebhookHandler({
    secret: "a-webhook-secret-value",
    inbox: {
      claim: async ({ eventId }) => eventId === "42",
      complete: async ({ eventId }) => { completed = eventId === "42"; },
      fail: async () => {}
    },
    dispatch: dispatcher
  });
  const response = await handler({
    headers: { "x-telegram-bot-api-secret-token": "a-webhook-secret-value" },
    rawBody: JSON.stringify(update)
  });
  assert.equal(response.status, 200);
  assert.equal(completed, true);
  assert.equal(executions.length, 1);
});
