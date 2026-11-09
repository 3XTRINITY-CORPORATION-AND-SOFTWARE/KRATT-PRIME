const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function proposePicoCloudRoute({ taskId, inputDigest, target = "local", dataTransferApproved = false }) {
  if (!ID.test(taskId ?? "") || !/^sha256:[0-9a-f]{64}$/.test(inputDigest ?? "")) return { ok: false, reason: "WORK_REQUEST_INVALID" };
  if (target !== "local" && target !== "remote") return { ok: false, reason: "WORKER_TARGET_INVALID" };
  if (target === "remote" && dataTransferApproved !== true) return { ok: true, state: "BLOCKED", reason: "REMOTE_TRANSFER_APPROVAL_REQUIRED", dispatch: false };
  return Object.freeze({ ok: true, state: "PROPOSED", taskId, target, inputDigest, dispatch: false,
    dryRun: true, workerInterface: "kratt-worker/v1" });
}

export function createWorkerAdapter({ describe }) {
  if (typeof describe !== "function") throw new TypeError("WORKER_DESCRIPTION_REQUIRED");
  return Object.freeze({ mode: "DESCRIBE_ONLY", async describe(request) {
    if (!request || typeof request !== "object" || typeof request.taskId !== "string") return { ok: false, reason: "WORK_REQUEST_INVALID" };
    const result = await describe(Object.freeze({ taskId: request.taskId, deadlineMs: Math.min(30_000, Math.max(1, request.deadlineMs ?? 5_000)) }));
    return Object.freeze({ ok: true, descriptor: result, executionStarted: false, externalEffects: false });
  } });
}
