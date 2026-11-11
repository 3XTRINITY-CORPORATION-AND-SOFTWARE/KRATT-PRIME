import { createHash } from "node:crypto";
import { canonicalEvidenceJson } from "../../kratt-core/src/evidence-ledger.mjs";
import { createEvidenceCard } from "./evidence-kernel.mjs";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const DATA_CLASSES = new Set(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]);
const TARGETS = new Set(["local", "remote"]);
const MAX_APPROVAL_LIFETIME_MS = 15 * 60 * 1000;
const admittedProposals = new WeakSet();
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const exact = (value, fields) => plain(value) && Reflect.ownKeys(value).length === fields.length &&
  fields.every(field => {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return Boolean(descriptor && "value" in descriptor && descriptor.get === undefined && descriptor.set === undefined);
  });
const time = value => typeof value === "string" && TIME.test(value) && Number.isFinite(Date.parse(value));
const stringList = value => Array.isArray(value) && value.length <= 128 && value.every(item => typeof item === "string" && ID.test(item)) &&
  new Set(value).size === value.length;
const hash = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;

function digestJson(value) {
  try { return hash(canonicalEvidenceJson(value)); }
  catch { return null; }
}

function block(reason, fields = {}) {
  const proposal = { schemaVersion: "kratt-worker-proposal/v1", state: "BLOCKED", reason,
    dispatch: false, executionStarted: false, externalEffects: false, ...fields };
  const planDigest = digestJson(proposal);
  return Object.freeze({ ok: true, ...proposal, planDigest });
}

function validateApproval(approval, schemaVersion, idField, binding, now) {
  const fields = ["schemaVersion", idField, "actorId", "taskDigest", "workerId", "target", "dataClass",
    "issuedAt", "expiresAt", "nonce", "keyId", "signature"];
  if (!exact(approval, fields) || approval.schemaVersion !== schemaVersion || !ID.test(approval[idField] ?? "") ||
      !ID.test(approval.actorId ?? "") || !HASH.test(approval.taskDigest ?? "") || !ID.test(approval.workerId ?? "") ||
      !TARGETS.has(approval.target) || !DATA_CLASSES.has(approval.dataClass) || !time(approval.issuedAt) || !time(approval.expiresAt) ||
      !ID.test(approval.nonce ?? "") || !ID.test(approval.keyId ?? "") || typeof approval.signature !== "string" ||
      approval.signature.length < 16 || approval.signature.length > 4096 || Date.parse(approval.issuedAt) > Date.parse(now) ||
      Date.parse(approval.expiresAt) <= Date.parse(now) ||
      Date.parse(approval.expiresAt) - Date.parse(approval.issuedAt) > MAX_APPROVAL_LIFETIME_MS) return false;
  return approval.actorId === binding.actorId && approval.taskDigest === binding.taskDigest &&
    approval.workerId === binding.workerId && approval.target === binding.target && approval.dataClass === binding.dataClass;
}

async function verifiedBy(verifier, proof, binding) {
  if (typeof verifier !== "function") return false;
  try { return await verifier(Object.freeze({ ...proof }), Object.freeze({ ...binding })) === true; }
  catch { return false; }
}

/** Pure worker admission planner. It never dispatches or starts execution. */
export async function createWorkerProposal({ task, worker, trustedContext, consent, approval,
  verifyConsent, verifyApproval } = {}) {
  const taskFields = ["schemaVersion", "taskId", "inputDigest", "target", "dataClass", "requiredCapabilities",
    "idempotencyKey", "deadline", "maxCostUnits", "maxDurationMs"];
  const workerFields = ["schemaVersion", "workerId", "mode", "targets", "dataClasses", "capabilities", "maxCostUnits", "maxDurationMs"];
  const contextFields = ["schemaVersion", "actorId", "principalScopes", "agentScopes", "taskScopes", "now", "globalKillSwitch", "maxCostUnits"];
  if (!exact(task, taskFields) || task.schemaVersion !== "kratt-worker-task/v1" || !ID.test(task.taskId ?? "") ||
      !HASH.test(task.inputDigest ?? "") || !TARGETS.has(task.target) || !DATA_CLASSES.has(task.dataClass) ||
      !stringList(task.requiredCapabilities) || !ID.test(task.idempotencyKey ?? "") || !time(task.deadline) ||
      !Number.isSafeInteger(task.maxCostUnits) || task.maxCostUnits < 1 || task.maxCostUnits > 1_000_000 ||
      !Number.isSafeInteger(task.maxDurationMs) || task.maxDurationMs < 1 || task.maxDurationMs > 86_400_000) {
    return Object.freeze({ ok: false, state: "BLOCKED", reason: "WORKER_TASK_INVALID", dispatch: false, executionStarted: false });
  }
  if (!exact(worker, workerFields) || worker.schemaVersion !== "kratt-worker-profile/v1" || !ID.test(worker.workerId ?? "") ||
      worker.mode !== "DESCRIBE_ONLY" || !Array.isArray(worker.targets) || worker.targets.length > 2 ||
      !worker.targets.every(target => TARGETS.has(target)) || !DATA_CLASSES.has(worker.dataClasses?.[0]) ||
      !Array.isArray(worker.dataClasses) || worker.dataClasses.length === 0 || worker.dataClasses.length > DATA_CLASSES.size ||
      !worker.dataClasses.every(dataClass => DATA_CLASSES.has(dataClass)) || new Set(worker.dataClasses).size !== worker.dataClasses.length ||
      !stringList(worker.capabilities) || !Number.isSafeInteger(worker.maxCostUnits) || worker.maxCostUnits < 1 ||
      !Number.isSafeInteger(worker.maxDurationMs) || worker.maxDurationMs < 1) {
    return block("WORKER_PROFILE_INVALID", { taskId: task.taskId });
  }
  if (!exact(trustedContext, contextFields) || trustedContext.schemaVersion !== "kratt-worker-trusted-context/v1" ||
      !ID.test(trustedContext.actorId ?? "") || !stringList(trustedContext.principalScopes) ||
      !stringList(trustedContext.agentScopes) || !stringList(trustedContext.taskScopes) || !time(trustedContext.now) ||
      typeof trustedContext.globalKillSwitch !== "boolean" || !Number.isSafeInteger(trustedContext.maxCostUnits) ||
      trustedContext.maxCostUnits < 1 || trustedContext.maxCostUnits > 1_000_000) {
    return block("TRUSTED_WORKER_CONTEXT_INVALID", { taskId: task.taskId, workerId: worker.workerId });
  }

  const taskDigest = digestJson(task);
  if (!taskDigest) return block("WORKER_TASK_CANONICALIZATION_FAILED", { taskId: task.taskId, workerId: worker.workerId });
  const fields = { taskId: task.taskId, actorId: trustedContext.actorId, workerId: worker.workerId, target: task.target, dataClass: task.dataClass,
    taskDigest, idempotencyKey: task.idempotencyKey };
  if (trustedContext.globalKillSwitch) return block("GLOBAL_KILL_SWITCH_ENABLED", fields);
  if (Date.parse(task.deadline) <= Date.parse(trustedContext.now)) return block("TASK_DEADLINE_EXPIRED", fields);
  if (!worker.targets.includes(task.target)) return block("WORKER_TARGET_UNSUPPORTED", fields);
  if (!worker.dataClasses.includes(task.dataClass)) return block("WORKER_DATA_CLASS_UNSUPPORTED", fields);
  if (task.maxCostUnits > Math.min(worker.maxCostUnits, trustedContext.maxCostUnits)) return block("WORKER_COST_BUDGET_EXCEEDED", fields);
  if (task.maxDurationMs > worker.maxDurationMs || task.maxDurationMs > Date.parse(task.deadline) - Date.parse(trustedContext.now)) {
    return block("WORKER_TIME_BUDGET_EXCEEDED", fields);
  }

  const scopes = [trustedContext.principalScopes, trustedContext.agentScopes, trustedContext.taskScopes, worker.capabilities];
  const effectiveCapabilities = task.requiredCapabilities.filter(capability => scopes.every(scope => scope.includes(capability)));
  if (effectiveCapabilities.length !== task.requiredCapabilities.length) return block("WORKER_CAPABILITY_SCOPE_INSUFFICIENT", { ...fields,
    effectiveCapabilities: Object.freeze(effectiveCapabilities) });

  let approvalIds = [];
  if (task.target === "remote") {
    if (task.dataClass === "RESTRICTED") return block("RESTRICTED_DATA_CANNOT_TARGET_REMOTE", fields);
    const binding = { actorId: trustedContext.actorId, taskDigest, workerId: worker.workerId, target: task.target, dataClass: task.dataClass };
    const consentValid = validateApproval(consent, "kratt-data-transfer-consent/v1", "consentId", binding, trustedContext.now) &&
      await verifiedBy(verifyConsent, consent, binding);
    if (!consentValid) return block("VERIFIED_EXACT_TRANSFER_CONSENT_REQUIRED", fields);
    const approvalValid = validateApproval(approval, "kratt-worker-dispatch-approval/v1", "approvalId", binding, trustedContext.now) &&
      await verifiedBy(verifyApproval, approval, binding);
    if (!approvalValid) return block("VERIFIED_EXACT_WORKER_APPROVAL_REQUIRED", fields);
    approvalIds = [consent.consentId, approval.approvalId];
  }

  const proposal = { schemaVersion: "kratt-worker-proposal/v1", state: "PROPOSED", reason: "WORKER_EXECUTION_NOT_IMPLEMENTED",
    ...fields, effectiveCapabilities: Object.freeze(effectiveCapabilities), maxCostUnits: task.maxCostUnits,
    maxDurationMs: task.maxDurationMs, deadline: task.deadline, approvalIds: Object.freeze(approvalIds),
    dispatch: false, executionStarted: false, externalEffects: false };
  const planDigest = digestJson(proposal);
  if (!planDigest) return block("WORKER_PROPOSAL_CANONICALIZATION_FAILED", fields);
  const result = Object.freeze({ ok: true, ...proposal, planDigest });
  admittedProposals.add(result);
  return result;
}

/** Reserve a validated proposal without authorizing or starting execution. */
export async function reserveWorkerProposal({ coordinator, proposal, ownerId, operationId, ttlMs } = {}) {
  if (!admittedProposals.has(proposal) || !coordinator || typeof coordinator.acquire !== "function" ||
      typeof ownerId !== "string" || !ID.test(ownerId) || typeof operationId !== "string" || !ID.test(operationId) ||
      !Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 15 * 60 * 1_000) {
    return Object.freeze({ ok: false, state: "BLOCKED", reason: "WORKER_PROPOSAL_LEASE_INPUT_INVALID", dispatch: false, executionStarted: false });
  }
  try {
    const lease = await coordinator.acquire({ operationId, reservationKey: proposal.idempotencyKey,
      taskDigest: proposal.taskDigest, ownerId, ttlMs });
    return Object.freeze({ ok: lease?.ok === true, state: lease?.ok === true ? "RESERVED" : "BLOCKED",
      reason: lease?.reason ?? null, proposalDigest: proposal.planDigest, reservationKey: proposal.idempotencyKey,
      ownerId: lease?.ownerId ?? ownerId, fencingToken: lease?.fencingToken ?? null, expiresAt: lease?.expiresAt ?? null,
      duplicate: lease?.duplicate === true, dispatch: false, executionStarted: false, externalEffects: false });
  } catch {
    return Object.freeze({ ok: false, state: "BLOCKED", reason: "WORKER_PROPOSAL_LEASE_FAILED", dispatch: false, executionStarted: false, externalEffects: false });
  }
}

/** Persist only the proposal outcome and metadata; never the input or approval proofs. */
export async function recordWorkerProposal({ repository, proposal, rootId, branchId, actorId, occurredAt } = {}) {
  if (!repository || typeof repository.append !== "function" || !proposal ||
      proposal.schemaVersion !== "kratt-worker-proposal/v1" || !["PROPOSED", "BLOCKED"].includes(proposal.state) ||
      !ID.test(rootId ?? "") || !ID.test(branchId ?? "") || !ID.test(actorId ?? "") || proposal.actorId !== actorId || !time(occurredAt) ||
      !ID.test(proposal.taskId ?? "") || !ID.test(proposal.workerId ?? "") || !HASH.test(proposal.planDigest ?? "")) {
    return Object.freeze({ ok: false, reason: "WORKER_PROPOSAL_AUDIT_INPUT_INVALID" });
  }
  const eventId = `worker-${createHash("sha256").update(`${rootId}\0${branchId}\0${proposal.taskId}\0${proposal.planDigest}`).digest("hex").slice(0, 48)}`;
  try {
    return await repository.append({ rootId, branchId, eventId,
      eventType: proposal.state === "PROPOSED" ? "worker.dispatch.proposed" : "worker.dispatch.blocked",
      actorId, occurredAt, subject: `worker-task:${proposal.taskId}`,
      decision: proposal.state === "PROPOSED" ? "OBSERVED" : "BLOCKED",
      sourceRef: { provider: "kratt-worker", resource: proposal.workerId, revision: null },
      artifactDigest: proposal.planDigest,
      metadata: { state: proposal.state, reason: proposal.reason, target: proposal.target ?? "unknown",
        dataClass: proposal.dataClass ?? "unknown", dispatch: false, executionStarted: false,
        effectiveCapabilities: proposal.effectiveCapabilities ?? [], maxCostUnits: proposal.maxCostUnits ?? 0,
        maxDurationMs: proposal.maxDurationMs ?? 0 } });
  } catch {
    return Object.freeze({ ok: false, reason: "WORKER_PROPOSAL_AUDIT_FAILED" });
  }
}


