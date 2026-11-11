const DECISIONS = new Set(["ALLOW", "DENY", "BLOCKED"]);
const SAFE_REASON = /^[A-Z][A-Z0-9_]{0,63}$/;

function blocked(reason) {
  return Object.freeze({ decision: "BLOCKED", reason, executionStarted: false });
}

/**
 * Fail-closed seam for a future server-owned policy runtime.
 * Evaluator is supplied only by trusted composition code, never HTTP input.
 * An ALLOW decision is advisory here: this stub cannot admit or execute tasks.
 */
export function createPolicyGate({ evaluator } = {}) {
  return Object.freeze({
    async evaluate(validatedTask) {
      if (!validatedTask || typeof validatedTask !== "object") return blocked("TASK_CONTEXT_INVALID");
      if (typeof evaluator !== "function") return blocked("POLICY_RUNTIME_NOT_CONFIGURED");
      let result;
      try {
        result = await evaluator(Object.freeze({ task: validatedTask, operation: "task.intake" }));
      } catch {
        return blocked("POLICY_EVALUATION_FAILED");
      }
      if (!result || !DECISIONS.has(result.decision) || result.executionStarted !== false) {
        return blocked("POLICY_RESULT_INVALID");
      }
      return Object.freeze({
        decision: result.decision,
        reason: typeof result.reason === "string" && SAFE_REASON.test(result.reason)
          ? result.reason : "POLICY_EVALUATED",
        executionStarted: false
      });
    }
  });
}
