import { validateTaskEnvelope } from "../../../../packages/kratt-core/src/contracts.mjs";
import { validateTelegramUpdate } from "../contracts/telegram-update.mjs";

/**
 * Compose Telegram webhook events with KRATT PRIME's trusted authorization runtime.
 *
 * The executor MUST be idempotent for a given idempotencyKey. The audit adapter
 * MUST durably and idempotently record (eventId, phase) and return true or {ok:true}.
 * A denied policy decision is audited and acknowledged without executing anything.
 */
export function createKrattTelegramDispatcher({
  authorizationRuntime,
  buildTask,
  getTrustedContext,
  getEvidence,
  getApproval = async () => undefined,
  execute,
  audit
} = {}) {
  if (!authorizationRuntime || typeof authorizationRuntime.evaluate !== "function" ||
      typeof buildTask !== "function" || typeof getTrustedContext !== "function" ||
      typeof getEvidence !== "function" || typeof getApproval !== "function" ||
      typeof execute !== "function" || !audit || typeof audit.record !== "function") {
    throw new TypeError("KRATT_TELEGRAM_DISPATCHER_DEPENDENCIES_REQUIRED");
  }

  async function record(entry) {
    const result = await audit.record(Object.freeze(entry));
    if (result !== true && result?.ok !== true) throw new Error("KRATT_TELEGRAM_AUDIT_WRITE_FAILED");
  }

  return async function dispatchTelegramEvent({ update, eventId, eventType } = {}) {
    const validation = validateTelegramUpdate(update);
    if (!validation.ok || String(validation.updateId) !== String(eventId) ||
        validation.eventType !== eventType) {
      throw new Error("KRATT_TELEGRAM_EVENT_BINDING_INVALID");
    }

    const task = await buildTask({ update, eventId: String(eventId), eventType });
    const checkedTask = validateTaskEnvelope(task);
    if (!checkedTask.ok || checkedTask.value.constraints.provider !== "telegram" ||
        checkedTask.value.constraints.event_id !== String(eventId)) {
      throw new Error("KRATT_TELEGRAM_TASK_BINDING_INVALID");
    }

    const [trustedContext, evidence, approval] = await Promise.all([
      getTrustedContext({ task: checkedTask.value, update, eventId: String(eventId), eventType }),
      getEvidence({ task: checkedTask.value, update, eventId: String(eventId), eventType }),
      getApproval({ task: checkedTask.value, update, eventId: String(eventId), eventType })
    ]);
    if (!Array.isArray(evidence)) throw new Error("KRATT_TELEGRAM_EVIDENCE_SET_INVALID");

    const decision = authorizationRuntime.evaluate(
      checkedTask.value,
      evidence,
      trustedContext,
      { approval }
    );
    if (decision && typeof decision.then === "function") {
      throw new Error("KRATT_TELEGRAM_ASYNC_POLICY_RUNTIME_UNSUPPORTED");
    }
    if (!decision || typeof decision.decision !== "string") {
      throw new Error("KRATT_TELEGRAM_POLICY_DECISION_INVALID");
    }

    await record({
      eventId: String(eventId),
      phase: "POLICY_DECISION",
      taskId: checkedTask.value.task_id,
      decisionId: decision.decision_id ?? null,
      decision: decision.decision,
      eventType
    });

    if (decision.decision !== "ALLOW") {
      return { ok: true, executed: false, decision };
    }

    await record({
      eventId: String(eventId),
      phase: "EXECUTION_INTENT",
      taskId: checkedTask.value.task_id,
      decisionId: decision.decision_id ?? null,
      decision: "ALLOW",
      eventType
    });

    let result;
    try {
      result = await execute({
        task: checkedTask.value,
        update,
        eventId: String(eventId),
        eventType,
        decision,
        idempotencyKey: String(eventId)
      });
    } catch (error) {
      await record({
        eventId: String(eventId),
        phase: "EXECUTION_FAILED",
        taskId: checkedTask.value.task_id,
        errorCode: typeof error?.code === "string" ? error.code.slice(0, 64) : "EXECUTION_FAILED"
      });
      throw error;
    }

    await record({
      eventId: String(eventId),
      phase: "EXECUTION_SUCCEEDED",
      taskId: checkedTask.value.task_id,
      decisionId: decision.decision_id ?? null
    });
    return { ok: true, executed: true, decision, result };
  };
}
