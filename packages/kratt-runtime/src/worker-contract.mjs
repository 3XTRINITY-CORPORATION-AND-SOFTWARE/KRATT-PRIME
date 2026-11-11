const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function proposePicoCloudRoute({ taskId, inputDigest, target = "local" } = {}) {
  if (!ID.test(taskId ?? "") || !/^sha256:[0-9a-f]{64}$/.test(inputDigest ?? "")) return { ok: false, reason: "WORK_REQUEST_INVALID" };
  if (target !== "local" && target !== "remote") return { ok: false, reason: "WORKER_TARGET_INVALID" };
  if (target === "remote") return Object.freeze({ ok: true, state: "BLOCKED",
    reason: "SERVER_VERIFIED_WORKER_APPROVAL_REQUIRED", taskId, target, dispatch: false, executionStarted: false });
  return Object.freeze({ ok: true, state: "PROPOSED", taskId, target, inputDigest, dispatch: false,
    dryRun: true, workerInterface: "kratt-worker/v1" });
}

export function createWorkerAdapter({ describe }) {
  if (typeof describe !== "function") throw new TypeError("WORKER_DESCRIPTION_REQUIRED");
  return Object.freeze({ mode: "DESCRIBE_ONLY", async describe(request) {
    if (!request || typeof request !== "object" || !ID.test(request.taskId ?? "")) return { ok: false, reason: "WORK_REQUEST_INVALID" };
    const deadlineMs = request.deadlineMs ?? 5_000;
    if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 30_000) return { ok: false, reason: "WORKER_DEADLINE_INVALID" };
    let result;
    try { result = await describe(Object.freeze({ taskId: request.taskId, deadlineMs })); }
    catch { return Object.freeze({ ok: false, reason: "WORKER_DESCRIPTION_FAILED", executionStarted: false }); }
    return Object.freeze({ ok: true, descriptor: result, executionStarted: false, externalEffects: false });
  } });
}

