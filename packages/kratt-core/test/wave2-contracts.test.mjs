import test from "node:test";
import assert from "node:assert/strict";
import {
  WAVE2_CONTRACT_VERSION,
  isCompatibleWave2Version,
  validateAgentBudget,
  validatePrivacyPolicy,
  validateAgentTask,
  validateAgentCapability,
  validateAgentExecutionContext,
  validateAgentExecutionResult,
  validateAgentError,
  validateAgentCancellation,
  validateAgentPolicy,
  validateEvidenceReference,
  validateProvenanceRecord,
  validateEvidenceObject,
  validateContradiction,
  validateInterpretation,
  validateVerificationResult,
  validateAuditEvent,
  validateRuntimeStatus,
  validateModelCapability,
  validateProviderAdapter,
  validateConsentRecord
} from "../src/wave2-contracts.mjs";

const version = WAVE2_CONTRACT_VERSION;
const now = "2026-11-23T12:00:00Z";
const later = "2026-11-23T12:01:00Z";
const budget = {
  schema_version: version, max_attempts: 2, timeout_ms: 30000,
  max_input_bytes: 100000, max_output_bytes: 10000,
  max_tokens: 1000, max_cost_microusd: 0
};
const privacy = {
  schema_version: version, processing_mode: "LOCAL_ONLY", consent_record_id: null,
  retain_input: false, retention_until: null, allow_training: false, redaction_required: true
};
const modelCapability = {
  schema_version: version, provider_id: "provider.local", model_id: "model.mock",
  modalities: ["TEXT"], capabilities: ["classify"], max_input_bytes: 100000,
  max_output_bytes: 10000, remote: false, supports_abort: true
};

const validCases = [
  ["budget", validateAgentBudget, budget],
  ["privacy policy", validatePrivacyPolicy, privacy],
  ["task", validateAgentTask, {
    schema_version: version, task_id: "task.1", run_id: "run.1", task_type: "pip.analysis",
    capability_id: "pip.analyze", input: { source_id: "source.1" }, depends_on: [],
    idempotency_key: "idem.1", requested_by: "user.1", created_at: now,
    deadline_at: later, budget, privacy
  }],
  ["capability", validateAgentCapability, {
    schema_version: version, capability_id: "pip.analyze", agent_id: "agent.local",
    version: "1.0.0", description: "Local PIP analysis", scopes: ["chiro.evaluate"],
    modalities: ["TEXT"], local_only: true, external: false, max_input_bytes: 100000,
    max_output_bytes: 10000, enabled: true
  }],
  ["execution context", validateAgentExecutionContext, {
    schema_version: version, task_id: "task.1", run_id: "run.1", agent_id: "agent.local",
    attempt: 1, started_at: now, deadline_at: later, cancellation_id: null,
    budget, policy_id: "policy.local", trace_id: "trace.1"
  }],
  ["execution result", validateAgentExecutionResult, {
    schema_version: version, task_id: "task.1", status: "SUCCEEDED", output: { label: "clear" },
    evidence_refs: ["evidence.1"], started_at: now, completed_at: later,
    usage: { input_bytes: 20, output_bytes: 12, tokens: 8, cost_microusd: 0 }
  }],
  ["error", validateAgentError, {
    schema_version: version, code: "W2_PROVIDER_TIMEOUT", message: "Provider deadline elapsed",
    retryable: true, stage: "provider.execute", task_id: "task.1", correlation_id: "trace.1", retry_after_ms: 100
  }],
  ["cancellation", validateAgentCancellation, {
    schema_version: version, cancellation_id: "cancel.1", task_id: "task.1",
    requested_by: "user.1", requested_at: now, reason: "User requested stop", status: "REQUESTED"
  }],
  ["policy", validateAgentPolicy, {
    schema_version: version, policy_id: "policy.local", version: "1.0.0",
    allowed_capability_ids: ["pip.analyze"], allowed_provider_ids: [], allowed_modalities: ["TEXT"],
    external_access: false, max_concurrency: 2, require_human_review: true
  }],
  ["evidence reference", validateEvidenceReference, {
    schema_version: version, evidence_id: "evidence.1", relationship: "SUPPORTS", source_id: "source.1"
  }],
  ["provenance", validateProvenanceRecord, {
    schema_version: version, provenance_id: "prov.1", source_type: "USER_INPUT", source_id: "source.1",
    revision: null, method: "user.submitted", captured_at: now, content_digest: null, independent: true
  }],
  ["evidence object", validateEvidenceObject, {
    schema_version: version, evidence_id: "evidence.1", subject_id: "claim.1", claim: "A bounded observation",
    kind: "OBSERVATION", provenance_id: "prov.1", observed_at: now, content_digest: null, status: "UNVERIFIED"
  }],
  ["contradiction", validateContradiction, {
    schema_version: version, contradiction_id: "contradiction.1", subject_id: "claim.1",
    evidence_ids: ["evidence.1", "evidence.2"], category: "SOURCE_CONFLICT", detected_at: now,
    status: "OPEN", resolution_id: null
  }],
  ["interpretation", validateInterpretation, {
    schema_version: version, interpretation_id: "interpretation.1", subject_id: "claim.1",
    statement: "A tentative reading", kind: "HYPOTHESIS", evidence_ids: ["evidence.1"],
    producer_id: "agent.local", confidence: 0.5, status: "PROPOSED", created_at: now
  }],
  ["verification", validateVerificationResult, {
    schema_version: version, verification_id: "verification.1", subject_id: "claim.1",
    producer_id: "agent.model", verifier_id: "reviewer.human", decision: "VERIFIED",
    evidence_ids: ["evidence.1"], independent: true, verified_at: now
  }],
  ["audit event", validateAuditEvent, {
    schema_version: version, event_id: "event.1", event_type: "agent.task.accepted", occurred_at: now,
    actor_id: "runtime.kratt", subject_id: "task.1", correlation_id: "trace.1", task_id: "task.1", outcome: "ACCEPTED"
  }],
  ["runtime status", validateRuntimeStatus, {
    schema_version: version, service_id: "runtime.wave2", health: "READY", checked_at: now,
    active_tasks: 0, queue_depth: 0, degraded_reasons: []
  }],
  ["model capability", validateModelCapability, modelCapability],
  ["provider adapter", validateProviderAdapter, {
    provider_id: "provider.local", capabilities: [modelCapability], execute: async () => ({})
  }],
  ["consent", validateConsentRecord, {
    schema_version: version, consent_id: "consent.1", subject_id: "user.1", purposes: ["chiro.analysis"],
    processing_mode: "LOCAL_ONLY", granted_by: "user.1", granted_at: now, expires_at: later, revoked_at: null
  }]
];

test("every public Wave 2 contract accepts its documented minimal value", () => {
  for (const [name, validate, value] of validCases) {
    const result = validate(value);
    assert.equal(result.ok, true, `${name}: ${JSON.stringify(result)}`);
  }
});

test("data contracts reject unknown keys, unsupported versions, getters, and unbounded JSON", () => {
  const task = validCases.find(([name]) => name === "task")[2];
  assert.equal(validateAgentTask({ ...task, unreviewed: true }).ok, false);
  assert.deepEqual(validateAgentTask({ ...task, schema_version: "2.0.0" }).errors, ["W2_VERSION_UNSUPPORTED"]);
  const withGetter = { ...task };
  Object.defineProperty(withGetter, "input", { enumerable: true, get() { throw new Error("must not execute"); } });
  assert.equal(validateAgentTask(withGetter).ok, false);
  assert.equal(validateAgentTask({ ...task, input: { nested: { payload: "x".repeat(50001) } } }).ok, false);
});

test("privacy and verification contracts fail closed", () => {
  assert.ok(validatePrivacyPolicy({ ...privacy, processing_mode: "REMOTE_APPROVED" }).errors.includes("W2_CONSENT_REQUIRED"));
  const verification = validCases.find(([name]) => name === "verification")[2];
  assert.equal(validateVerificationResult({ ...verification, verifier_id: verification.producer_id }).ok, false);
  assert.equal(validateVerificationResult({ ...verification, independent: false }).ok, false);
  const provenance = validCases.find(([name]) => name === "provenance")[2];
  assert.equal(validateProvenanceRecord({ ...provenance, source_type: "MODEL_OUTPUT", independent: true }).ok, false);
});

test("hypotheses cannot be represented as verified facts and contracts are immutable", () => {
  const evidence = validCases.find(([name]) => name === "evidence object")[2];
  assert.equal(validateEvidenceObject({ ...evidence, kind: "HYPOTHESIS", status: "SUPPORTED" }).ok, false);
  const result = validateAgentTask(validCases.find(([name]) => name === "task")[2]);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.input), true);
});

test("provider adapters require validated capabilities and an execution function", () => {
  const adapter = validCases.find(([name]) => name === "provider adapter")[2];
  assert.equal(validateProviderAdapter({ ...adapter, execute: null }).ok, false);
  assert.equal(validateProviderAdapter(adapter).value.capabilities[0].model_id, "model.mock");
});

test("Wave 2 accepts only compatible 1.0 patch versions", () => {
  assert.equal(isCompatibleWave2Version("1.0.7"), true);
  assert.equal(isCompatibleWave2Version("1.1.0"), false);
  assert.equal(isCompatibleWave2Version("2.0.0"), false);
  assert.equal(isCompatibleWave2Version("invalid"), false);
});
