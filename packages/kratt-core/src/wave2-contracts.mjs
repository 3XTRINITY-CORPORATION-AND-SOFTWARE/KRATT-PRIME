export const WAVE2_CONTRACT_VERSION = "1.0.0";
export const WAVE2_SCHEMA_VERSION = WAVE2_CONTRACT_VERSION;

export const TASK_STATUSES = Object.freeze([
  "PENDING", "READY", "BLOCKED", "RUNNING", "RETRY_WAIT",
  "SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"
]);
export const EXECUTION_STATUSES = Object.freeze(["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"]);
export const EVIDENCE_STATUSES = Object.freeze(["UNVERIFIED", "SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE"]);
export const VERIFICATION_DECISIONS = Object.freeze(["VERIFIED", "REJECTED", "UNAVAILABLE", "CONFLICT"]);
export const PRIVACY_MODES = Object.freeze(["LOCAL_ONLY", "REMOTE_APPROVED"]);
export const RUNTIME_HEALTH = Object.freeze(["READY", "DEGRADED", "BLOCKED", "STOPPED"]);

export const WAVE2_EVENT_TYPES = Object.freeze([
  "agent.task.accepted", "agent.task.blocked", "agent.task.started",
  "agent.task.retry_scheduled", "agent.task.completed", "agent.task.failed",
  "agent.task.cancelled", "agent.task.timed_out", "agent.evidence.recorded",
  "agent.contradiction.detected", "agent.interpretation.proposed",
  "agent.verification.completed", "agent.runtime.status_changed"
]);

export const WAVE2_ERROR_CODES = Object.freeze([
  "W2_CONTRACT_INVALID", "W2_VERSION_UNSUPPORTED", "W2_TASK_DUPLICATE",
  "W2_TASK_NOT_FOUND", "W2_DEPENDENCY_INVALID", "W2_DEPENDENCY_CYCLE",
  "W2_CAPABILITY_DENIED", "W2_POLICY_DENIED", "W2_CONSENT_REQUIRED",
  "W2_PROVIDER_DISABLED", "W2_PROVIDER_UNAVAILABLE", "W2_PROVIDER_TIMEOUT",
  "W2_BUDGET_EXCEEDED", "W2_CANCELLED", "W2_DEADLINE_EXCEEDED",
  "W2_EVIDENCE_INVALID", "W2_VERIFICATION_UNAVAILABLE", "W2_AUDIT_UNAVAILABLE",
  "W2_STATE_CONFLICT", "W2_STORAGE_UNAVAILABLE"
]);

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const validId = value => typeof value === "string" && ID.test(value);
const validText = (value, max = 1000) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const validTime = value => typeof value === "string" && UTC.test(value) && Number.isFinite(Date.parse(value));
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const nullableTime = value => value === null || validTime(value);
const nullableId = value => value === null || validId(value);

function plainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function exactKeys(value, required, optional = []) {
  if (!plainObject(value)) return false;
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== "string" || !allowed.has(key))) return false;
  if (required.some(key => !own(value, key))) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor && !descriptor.get && !descriptor.set;
  });
}

function boundedJson(value, { maxDepth = 8, maxNodes = 1024, maxText = 10000 } = {}) {
  const seen = new WeakSet();
  let nodes = 0;
  function visit(item, depth) {
    nodes += 1;
    if (nodes > maxNodes || depth > maxDepth) return false;
    if (item === null || typeof item === "boolean") return true;
    if (typeof item === "string") return item.length <= maxText;
    if (typeof item === "number") return Number.isFinite(item);
    if (typeof item !== "object" || seen.has(item)) return false;
    seen.add(item);
    if (Array.isArray(item)) return item.length <= 256 && item.every(entry => visit(entry, depth + 1));
    if (!plainObject(item)) return false;
    const keys = Reflect.ownKeys(item);
    if (keys.length > 128 || keys.some(key => typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key))) return false;
    return keys.every(key => {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      return descriptor && "value" in descriptor && !descriptor.get && !descriptor.set && visit(descriptor.value, depth + 1);
    });
  }
  return visit(value, 0);
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
    Object.freeze(value);
  }
  return value;
}

function finish(input, errors) {
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  try {
    return { ok: true, value: deepFreeze(structuredClone(input)) };
  } catch {
    return { ok: false, errors: ["W2_CONTRACT_INVALID"] };
  }
}

function header(input, keys, optional = []) {
  const errors = [];
  if (!exactKeys(input, ["schema_version", ...keys], optional)) return ["W2_CONTRACT_INVALID"];
  if (input.schema_version !== WAVE2_SCHEMA_VERSION) errors.push("W2_VERSION_UNSUPPORTED");
  return errors;
}

function idList(value, max = 64, min = 0) {
  return Array.isArray(value) && value.length >= min && value.length <= max &&
    value.every(validId) && new Set(value).size === value.length;
}

function stringList(value, allowed, max = 32, min = 0) {
  return Array.isArray(value) && value.length >= min && value.length <= max &&
    value.every(item => typeof item === "string" && allowed.includes(item)) && new Set(value).size === value.length;
}

function validBudget(value) {
  return validateAgentBudget(value).ok;
}
function validPrivacy(value) {
  return validatePrivacyPolicy(value).ok;
}

export function isCompatibleWave2Version(version) {
  if (typeof version !== "string") return false;
  const match = version.match(SEMVER);
  return Boolean(match && Number(match[1]) === 1 && Number(match[2]) === 0);
}

export function validateAgentBudget(input) {
  const errors = header(input, ["max_attempts", "timeout_ms", "max_input_bytes", "max_output_bytes", "max_tokens", "max_cost_microusd"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!integer(input.max_attempts, 1, 10) || !integer(input.timeout_ms, 1, 900000) ||
      !integer(input.max_input_bytes, 1, 50_000_000) || !integer(input.max_output_bytes, 1, 5_000_000) ||
      !integer(input.max_tokens, 0, 10_000_000) || !integer(input.max_cost_microusd, 0, 100_000_000)) errors.push("W2_BUDGET_INVALID");
  return finish(input, errors);
}

export function validatePrivacyPolicy(input) {
  const errors = header(input, ["processing_mode", "consent_record_id", "retain_input", "retention_until", "allow_training", "redaction_required"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!PRIVACY_MODES.includes(input.processing_mode) || !nullableId(input.consent_record_id) ||
      typeof input.retain_input !== "boolean" || !nullableTime(input.retention_until) ||
      typeof input.allow_training !== "boolean" || typeof input.redaction_required !== "boolean") errors.push("W2_PRIVACY_POLICY_INVALID");
  if (input.processing_mode === "REMOTE_APPROVED" && !validId(input.consent_record_id)) errors.push("W2_CONSENT_REQUIRED");
  if (!input.retain_input && input.retention_until !== null) errors.push("W2_PRIVACY_POLICY_INVALID");
  if (!input.retain_input && input.allow_training) errors.push("W2_PRIVACY_POLICY_INVALID");
  return finish(input, errors);
}

export function validateAgentTask(input) {
  const errors = header(input, ["task_id", "run_id", "task_type", "capability_id", "input", "depends_on", "idempotency_key", "requested_by", "created_at", "deadline_at", "budget", "privacy"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.task_id) || !validId(input.run_id) || !validId(input.task_type) || !validId(input.capability_id) ||
      !validText(input.idempotency_key, 256) || !validId(input.requested_by)) errors.push("W2_TASK_INVALID");
  if (!idList(input.depends_on, 128) || input.depends_on.includes(input.task_id)) errors.push("W2_DEPENDENCY_INVALID");
  if (!plainObject(input.input) || !boundedJson(input.input, { maxDepth: 8, maxNodes: 2048, maxText: 50000 })) errors.push("W2_TASK_INPUT_INVALID");
  if (!validTime(input.created_at) || !validTime(input.deadline_at) || Date.parse(input.deadline_at) <= Date.parse(input.created_at)) errors.push("W2_TASK_DEADLINE_INVALID");
  if (!validBudget(input.budget)) errors.push("W2_BUDGET_INVALID");
  if (!validPrivacy(input.privacy)) errors.push("W2_PRIVACY_POLICY_INVALID");
  return finish(input, errors);
}

export function validateAgentCapability(input) {
  const errors = header(input, ["capability_id", "agent_id", "version", "description", "scopes", "modalities", "local_only", "external", "max_input_bytes", "max_output_bytes", "enabled"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.capability_id) || !validId(input.agent_id) || typeof input.version !== "string" || !SEMVER.test(input.version) || !validText(input.description, 512) ||
      !idList(input.scopes, 64, 0) || !stringList(input.modalities, ["TEXT", "IMAGE", "AUDIO", "VIDEO", "STRUCTURED"], 8, 1) ||
      typeof input.local_only !== "boolean" || typeof input.external !== "boolean" || typeof input.enabled !== "boolean" ||
      !integer(input.max_input_bytes, 1, 50_000_000) || !integer(input.max_output_bytes, 1, 5_000_000)) errors.push("W2_CAPABILITY_INVALID");
  if (input.local_only && input.external) errors.push("W2_CAPABILITY_INVALID");
  return finish(input, errors);
}

export function validateAgentExecutionContext(input) {
  const errors = header(input, ["task_id", "run_id", "agent_id", "attempt", "started_at", "deadline_at", "cancellation_id", "budget", "policy_id", "trace_id"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.task_id) || !validId(input.run_id) || !validId(input.agent_id) || !integer(input.attempt, 1, 10) ||
      !validTime(input.started_at) || !validTime(input.deadline_at) || Date.parse(input.deadline_at) <= Date.parse(input.started_at) ||
      !nullableId(input.cancellation_id) || !validBudget(input.budget) || !validId(input.policy_id) || !validId(input.trace_id)) errors.push("W2_EXECUTION_CONTEXT_INVALID");
  return finish(input, errors);
}

export const validateExecutionContext = validateAgentExecutionContext;

export function validateAgentExecutionResult(input) {
  const errors = header(input, ["task_id", "status", "output", "evidence_refs", "started_at", "completed_at", "usage"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.task_id) || !EXECUTION_STATUSES.includes(input.status) || !plainObject(input.output) ||
      !boundedJson(input.output, { maxDepth: 8, maxNodes: 2048, maxText: 50000 }) || !idList(input.evidence_refs, 128) ||
      !validTime(input.started_at) || !validTime(input.completed_at) || Date.parse(input.completed_at) < Date.parse(input.started_at) ||
      !exactKeys(input.usage, ["input_bytes", "output_bytes", "tokens", "cost_microusd"]) ||
      ![input.usage.input_bytes, input.usage.output_bytes, input.usage.tokens, input.usage.cost_microusd].every(value => integer(value, 0, 100_000_000))) errors.push("W2_EXECUTION_RESULT_INVALID");
  return finish(input, errors);
}

export function validateAgentError(input) {
  const errors = header(input, ["code", "message", "retryable", "stage", "task_id", "correlation_id", "retry_after_ms"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!WAVE2_ERROR_CODES.includes(input.code) || !validText(input.message, 512) || typeof input.retryable !== "boolean" ||
      !validId(input.stage) || !nullableId(input.task_id) || !validId(input.correlation_id) ||
      !(input.retry_after_ms === null || integer(input.retry_after_ms, 0, 3_600_000))) errors.push("W2_ERROR_INVALID");
  return finish(input, errors);
}

export function validateAgentCancellation(input) {
  const errors = header(input, ["cancellation_id", "task_id", "requested_by", "requested_at", "reason", "status"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.cancellation_id) || !validId(input.task_id) || !validId(input.requested_by) || !validTime(input.requested_at) ||
      !validText(input.reason, 256) || !["REQUESTED", "ACKNOWLEDGED", "TOO_LATE"].includes(input.status)) errors.push("W2_CANCELLATION_INVALID");
  return finish(input, errors);
}

export function validateAgentPolicy(input) {
  const errors = header(input, ["policy_id", "version", "allowed_capability_ids", "allowed_provider_ids", "allowed_modalities", "external_access", "max_concurrency", "require_human_review"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.policy_id) || !validText(input.version, 64) || !idList(input.allowed_capability_ids, 128) ||
      !idList(input.allowed_provider_ids, 64) || !stringList(input.allowed_modalities, ["TEXT", "IMAGE", "AUDIO", "VIDEO", "STRUCTURED"], 8) ||
      typeof input.external_access !== "boolean" || !integer(input.max_concurrency, 1, 256) || typeof input.require_human_review !== "boolean") errors.push("W2_POLICY_INVALID");
  return finish(input, errors);
}

export function validateEvidenceReference(input) {
  const errors = header(input, ["evidence_id", "relationship", "source_id"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.evidence_id) || !["SUPPORTS", "CONTRADICTS", "DERIVED_FROM", "CONTEXT_FOR"].includes(input.relationship) || !validId(input.source_id)) errors.push("W2_EVIDENCE_REFERENCE_INVALID");
  return finish(input, errors);
}

export function validateProvenanceRecord(input) {
  const errors = header(input, ["provenance_id", "source_type", "source_id", "revision", "method", "captured_at", "content_digest", "independent"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.provenance_id) || !["USER_INPUT", "RETRIEVED_SOURCE", "MODEL_OUTPUT", "HUMAN_REVIEW", "SYSTEM"].includes(input.source_type) ||
      !validId(input.source_id) || !nullableId(input.revision) || !validId(input.method) || !validTime(input.captured_at) ||
      !(input.content_digest === null || (typeof input.content_digest === "string" && DIGEST.test(input.content_digest))) || typeof input.independent !== "boolean") errors.push("W2_PROVENANCE_INVALID");
  if (input.source_type === "MODEL_OUTPUT" && input.independent) errors.push("W2_PROVENANCE_INVALID");
  return finish(input, errors);
}

export function validateEvidenceObject(input) {
  const errors = header(input, ["evidence_id", "subject_id", "claim", "kind", "provenance_id", "observed_at", "content_digest", "status"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.evidence_id) || !validId(input.subject_id) || !validText(input.claim, 4000) ||
      !["OBSERVATION", "SOURCE_CLAIM", "HYPOTHESIS", "HUMAN_REVIEW", "SYSTEM_RECORD"].includes(input.kind) ||
      !validId(input.provenance_id) || !validTime(input.observed_at) ||
      !(input.content_digest === null || (typeof input.content_digest === "string" && DIGEST.test(input.content_digest))) ||
      !EVIDENCE_STATUSES.includes(input.status)) errors.push("W2_EVIDENCE_INVALID");
  if (input.kind === "HYPOTHESIS" && input.status === "SUPPORTED") errors.push("W2_EVIDENCE_INVALID");
  return finish(input, errors);
}

export function validateContradiction(input) {
  const errors = header(input, ["contradiction_id", "subject_id", "evidence_ids", "category", "detected_at", "status", "resolution_id"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.contradiction_id) || !validId(input.subject_id) || !idList(input.evidence_ids, 64, 2) ||
      !["SOURCE_CONFLICT", "INTERPRETATION_CONFLICT", "PROVENANCE_CONFLICT", "TEMPORAL_CONFLICT", "OTHER"].includes(input.category) ||
      !validTime(input.detected_at) || !["OPEN", "UNDER_REVIEW", "RESOLVED", "UNRESOLVED"].includes(input.status) || !nullableId(input.resolution_id)) errors.push("W2_CONTRADICTION_INVALID");
  if (input.status === "OPEN" && input.resolution_id !== null) errors.push("W2_CONTRADICTION_INVALID");
  if (input.status === "RESOLVED" && !validId(input.resolution_id)) errors.push("W2_CONTRADICTION_INVALID");
  return finish(input, errors);
}

export function validateInterpretation(input) {
  const errors = header(input, ["interpretation_id", "subject_id", "statement", "kind", "evidence_ids", "producer_id", "confidence", "status", "created_at"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.interpretation_id) || !validId(input.subject_id) || !validText(input.statement, 4000) ||
      !["SOURCE_CLAIM", "HYPOTHESIS", "SUMMARY"].includes(input.kind) || !idList(input.evidence_ids, 128) ||
      !validId(input.producer_id) || typeof input.confidence !== "number" || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1 ||
      !["PROPOSED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "UNVERIFIED"].includes(input.status) || !validTime(input.created_at)) errors.push("W2_INTERPRETATION_INVALID");
  if (input.kind === "HYPOTHESIS" && input.status === "ACCEPTED") errors.push("W2_INTERPRETATION_INVALID");
  return finish(input, errors);
}

export function validateVerificationResult(input) {
  const errors = header(input, ["verification_id", "subject_id", "producer_id", "verifier_id", "decision", "evidence_ids", "independent", "verified_at"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.verification_id) || !validId(input.subject_id) || !validId(input.producer_id) || !validId(input.verifier_id) ||
      !VERIFICATION_DECISIONS.includes(input.decision) || !idList(input.evidence_ids, 128) || typeof input.independent !== "boolean" || !validTime(input.verified_at)) errors.push("W2_VERIFICATION_INVALID");
  if (input.producer_id === input.verifier_id || !input.independent) errors.push("W2_VERIFICATION_INVALID");
  return finish(input, errors);
}

export function validateAuditEvent(input) {
  const errors = header(input, ["event_id", "event_type", "occurred_at", "actor_id", "subject_id", "correlation_id", "task_id", "outcome"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.event_id) || !WAVE2_EVENT_TYPES.includes(input.event_type) || !validTime(input.occurred_at) ||
      !validId(input.actor_id) || !validId(input.subject_id) || !validId(input.correlation_id) || !nullableId(input.task_id) ||
      !["ACCEPTED", "DENIED", "COMPLETED", "FAILED", "OBSERVED"].includes(input.outcome)) errors.push("W2_AUDIT_EVENT_INVALID");
  return finish(input, errors);
}

export function validateRuntimeStatus(input) {
  const errors = header(input, ["service_id", "health", "checked_at", "active_tasks", "queue_depth", "degraded_reasons"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.service_id) || !RUNTIME_HEALTH.includes(input.health) || !validTime(input.checked_at) ||
      !integer(input.active_tasks, 0, 100000) || !integer(input.queue_depth, 0, 100000) ||
      !Array.isArray(input.degraded_reasons) || input.degraded_reasons.length > 32 || input.degraded_reasons.some(reason => !validText(reason, 256))) errors.push("W2_RUNTIME_STATUS_INVALID");
  if (input.health === "READY" && Array.isArray(input.degraded_reasons) && input.degraded_reasons.length) errors.push("W2_RUNTIME_STATUS_INVALID");
  if (["DEGRADED", "BLOCKED"].includes(input.health) && Array.isArray(input.degraded_reasons) && input.degraded_reasons.length === 0) errors.push("W2_RUNTIME_STATUS_INVALID");
  return finish(input, errors);
}

export function validateModelCapability(input) {
  const errors = header(input, ["provider_id", "model_id", "modalities", "capabilities", "max_input_bytes", "max_output_bytes", "remote", "supports_abort"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.provider_id) || !validId(input.model_id) || !stringList(input.modalities, ["TEXT", "IMAGE", "AUDIO", "VIDEO", "STRUCTURED"], 8, 1) ||
      !idList(input.capabilities, 64) || !integer(input.max_input_bytes, 1, 50_000_000) || !integer(input.max_output_bytes, 1, 5_000_000) ||
      typeof input.remote !== "boolean" || typeof input.supports_abort !== "boolean") errors.push("W2_MODEL_CAPABILITY_INVALID");
  return finish(input, errors);
}

export function validateProviderAdapter(input) {
  if (!exactKeys(input, ["provider_id", "capabilities", "execute"])) return { ok: false, errors: ["W2_PROVIDER_ADAPTER_INVALID"] };
  if (!validId(input.provider_id) || !Array.isArray(input.capabilities) || input.capabilities.length > 64 || typeof input.execute !== "function") return { ok: false, errors: ["W2_PROVIDER_ADAPTER_INVALID"] };
  const capabilities = input.capabilities.map(validateModelCapability);
  if (capabilities.some(capability => !capability.ok)) return { ok: false, errors: ["W2_PROVIDER_ADAPTER_INVALID"] };
  if (capabilities.some(capability => capability.value.provider_id !== input.provider_id)) return { ok: false, errors: ["W2_PROVIDER_ADAPTER_INVALID"] };
  return { ok: true, value: Object.freeze({ provider_id: input.provider_id, capabilities: Object.freeze(capabilities.map(capability => capability.value)), execute: input.execute }) };
}

export function validateConsentRecord(input) {
  const errors = header(input, ["consent_id", "subject_id", "purposes", "processing_mode", "granted_by", "granted_at", "expires_at", "revoked_at"]);
  if (errors[0] === "W2_CONTRACT_INVALID") return { ok: false, errors };
  if (!validId(input.consent_id) || !validId(input.subject_id) || !idList(input.purposes, 32, 1) || !PRIVACY_MODES.includes(input.processing_mode) ||
      !validId(input.granted_by) || !validTime(input.granted_at) || !validTime(input.expires_at) || Date.parse(input.expires_at) <= Date.parse(input.granted_at) ||
      !nullableTime(input.revoked_at)) errors.push("W2_CONSENT_INVALID");
  if (input.revoked_at !== null && Date.parse(input.revoked_at) < Date.parse(input.granted_at)) errors.push("W2_CONSENT_INVALID");
  return finish(input, errors);
}
