import test from "node:test";
import assert from "node:assert/strict";
import { createServerApp } from "../src/app.mjs";
import { loadServerConfig } from "../src/config.mjs";
import { createInMemoryStatusRegistry, STATUS_MATRIX_SHAPE } from "../src/status-registry.mjs";
import { createInMemoryAuditAdapter } from "../src/audit-adapter.mjs";
import { createPolicyGate } from "../src/policy-gate.mjs";

async function withServer(run, options) {
  const server = createServerApp(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

const validTask = () => ({
  schema_version: "kratt-prime/v0.1",
  task_id: "inventory-17",
  actor: "repo-scout",
  action: "repo.read",
  target: { resource_type: "repository", resource_id: "example/project" },
  constraints: {},
  required_evidence: [],
  created_at: "2026-11-09T12:00:00Z",
  requested_authority: ["repository.read"],
  status: "PENDING"
});

const postJson = (baseUrl, path, body) => fetch(`${baseUrl}${path}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
});

test("config defaults to loopback and rejects public binds or malformed values", () => {
  assert.deepEqual(loadServerConfig({}), { host: "127.0.0.1", port: 3000, nodeEnv: "development" });
  assert.equal(Object.isFrozen(loadServerConfig({})), true);
  assert.deepEqual(loadServerConfig({ HOST: "127.0.0.1", PORT: "8080", NODE_ENV: "production" }), {
    host: "127.0.0.1", port: 8080, nodeEnv: "production"
  });
  assert.equal(loadServerConfig({ HOST: "::1" }).host, "::1");
  for (const env of [
    { PORT: "-1" }, { PORT: "65536" }, { PORT: "3.5" }, { HOST: "bad host" },
    { HOST: "0.0.0.0" }, { HOST: "192.168.1.10" }, { NODE_ENV: "unknown" }
  ]) assert.throws(() => loadServerConfig(env), TypeError);
});

test("status registry is a bounded five-by-five module matrix", () => {
  let tick = 0;
  const registry = createInMemoryStatusRegistry({ now: () => `2026-11-10T00:00:0${tick++}Z` });
  const rows = registry.list();
  assert.deepEqual(STATUS_MATRIX_SHAPE, { rows: 5, columns: 5 });
  assert.equal(rows.length, 5);
  assert.ok(rows.every(row => Object.keys(row).length === 5 && row.executionEnabled === false));
  assert.equal(registry.update("policy-gate", "READY").ok, true);
  assert.equal(registry.update("unknown", "READY").ok, false);
  assert.equal(registry.update("policy-gate", "SECRET").ok, false);
});

test("policy gate blocks when unconfigured, validates evaluator output, and never starts execution", async () => {
  assert.deepEqual(await createPolicyGate().evaluate({ task_id: "t-1" }), {
    decision: "BLOCKED", reason: "POLICY_RUNTIME_NOT_CONFIGURED", executionStarted: false
  });
  const allowed = await createPolicyGate({ evaluator: async input => {
    assert.equal(input.operation, "task.intake");
    return { decision: "ALLOW", reason: "TEST_POLICY", executionStarted: false };
  } }).evaluate({ task_id: "t-1" });
  assert.deepEqual(allowed, { decision: "ALLOW", reason: "TEST_POLICY", executionStarted: false });
  assert.deepEqual(await createPolicyGate({ evaluator: async () => ({ decision: "ALLOW", executionStarted: true }) })
    .evaluate({ task_id: "t-1" }), {
    decision: "BLOCKED", reason: "POLICY_RESULT_INVALID", executionStarted: false
  });
});

test("audit adapter appends idempotency-distinct events and verifies the hash chain", () => {
  let tick = 0;
  const audit = createInMemoryAuditAdapter({ now: () => new Date(Date.UTC(2026, 10, 10, 0, 0, tick++)) });
  const decision = { decision: "BLOCKED", reason: "POLICY_RUNTIME_NOT_CONFIGURED", executionStarted: false };
  assert.equal(audit.recordIntakeDecision({ taskId: "inventory-17", policy: decision }).ok, true);
  assert.equal(audit.recordIntakeDecision({ taskId: "inventory-18", policy: decision }).ok, true);
  assert.equal(audit.size, 2);
  assert.equal(audit.verify().ok, true);
});

test("status, health and audit routes expose only bounded metadata", async () => {
  await withServer(async baseUrl => {
    const health = await fetch(`${baseUrl}/health/live`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual((await health.json()).health, { liveness: "healthy" });

    const ready = await (await fetch(`${baseUrl}/health/ready`)).json();
    assert.deepEqual(ready.health, { readiness: "ready", executionEnabled: false });

    const status = await (await fetch(`${baseUrl}/v1/status`)).json();
    assert.equal(status.capabilities.taskAdmission, false);
    assert.equal(status.modules.length, 5);
    assert.ok(status.modules.every(row => row.executionEnabled === false));

    const audit = await fetch(`${baseUrl}/v1/audit/status`);
    assert.equal(audit.status, 200);
    assert.deepEqual(await audit.json(), {
      ok: true, audit: { availability: "available", integrity: "verified", headSequence: 0 }
    });
  });
});

test("task validation validates schema without admitting or executing", async () => {
  await withServer(async baseUrl => {
    const valid = await postJson(baseUrl, "/v1/tasks/validate", validTask());
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), {
      ok: true, valid: true, schemaVersion: "kratt-prime/v0.1",
      admitted: false, executionStarted: false
    });
    const invalid = await postJson(baseUrl, "/v1/tasks/validate", { ...validTask(), extra: true });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).errors[0], "TASK_SHAPE_INVALID");
  });
});

test("task intake evaluates policy and audits but never admits or executes", async () => {
  await withServer(async baseUrl => {
    const blocked = await postJson(baseUrl, "/v1/tasks/intake", validTask());
    assert.equal(blocked.status, 503);
    assert.deepEqual(await blocked.json(), {
      ok: false, apiVersion: "v1", taskId: "inventory-17", valid: true,
      policy: { decision: "BLOCKED", reason: "POLICY_RUNTIME_NOT_CONFIGURED", executionStarted: false },
      admitted: false, executionStarted: false
    });
  });

  await withServer(async baseUrl => {
    const response = await postJson(baseUrl, "/v1/tasks/intake", validTask());
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.policy.decision, "ALLOW");
    assert.equal(result.admitted, false);
    assert.equal(result.executionStarted, false);
    assert.equal((await (await fetch(`${baseUrl}/v1/audit/status`)).json()).audit.headSequence, 1);
  }, { policyGate: createPolicyGate({ evaluator: async () => ({
    decision: "ALLOW", reason: "TEST_POLICY_ALLOW", executionStarted: false
  }) }) });
});

test("task intake fails closed if audit append fails", async () => {
  await withServer(async baseUrl => {
    const response = await postJson(baseUrl, "/v1/tasks/intake", validTask());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      ok: false, error: "AUDIT_WRITE_UNAVAILABLE", admitted: false, executionStarted: false
    });
  }, { auditAdapter: { verify: () => ({ ok: true }), size: 0, recordIntakeDecision: () => ({ ok: false }) } });
});

test("request validator enforces JSON content type and body size", async () => {
  await withServer(async baseUrl => {
    const wrongType = await fetch(`${baseUrl}/v1/tasks/validate`, {
      method: "POST", headers: { "content-type": "text/plain" }, body: "{}"
    });
    assert.equal(wrongType.status, 415);
    const tooLarge = await fetch(`${baseUrl}/v1/tasks/validate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(33 * 1024) })
    });
    assert.equal(tooLarge.status, 413);
    assert.deepEqual(await tooLarge.json(), { ok: false, error: "REQUEST_TOO_LARGE" });
  });
});

test("unknown paths and unsupported methods return generic errors", async () => {
  await withServer(async baseUrl => {
    const missing = await fetch(`${baseUrl}/private`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { ok: false, error: "NOT_FOUND" });
    const write = await fetch(`${baseUrl}/health`, { method: "DELETE" });
    assert.equal(write.status, 405);
    assert.equal(write.headers.get("allow"), "GET, HEAD");
  });
});
