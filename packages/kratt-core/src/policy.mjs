import { POLICY_DECISIONS, validateEvidenceRecord, validateTaskEnvelope, validateTrustedContext } from "./contracts.mjs";

function decision(taskId, value, reasons, evidenceIds, evaluatedAt) {
  return Object.freeze({
    schema_version: "kratt-prime/v0.1",
    decision_id: `decision:${taskId}`,
    task_id: taskId,
    decision: value,
    reasons: Object.freeze(reasons),
    evidence_ids: Object.freeze(evidenceIds),
    evaluated_at: evaluatedAt
  });
}

/** Pure authorization evaluator. Request-provided authority is never trusted. */
export function evaluatePolicy(taskInput, evidenceInput, trustedContextInput) {
  const task = validateTaskEnvelope(taskInput);
  const taskId = task.ok ? task.value.task_id : "invalid";
  const context = validateTrustedContext(trustedContextInput);
  const evaluatedAt = context.ok ? context.value.evaluated_at : null;
  if (!task.ok) return decision(taskId,"DENY",["INVALID_TASK_ENVELOPE"],[],evaluatedAt);
  if (!context.ok) return decision(taskId,"BLOCKED",["INVALID_TRUSTED_CONTEXT"],[],null);

  const t = task.value, c = context.value;
  if (!Array.isArray(evidenceInput) || evidenceInput.length > 256)
    return decision(t.task_id,"INSUFFICIENT_EVIDENCE",["INVALID_EVIDENCE_SET"],[],evaluatedAt);
  if (!c.policies?.length) return decision(t.task_id,"BLOCKED",["MISSING_POLICY"],[],evaluatedAt);
  const rule = c.policies.find(p => p.action === t.action);
  if (!rule) return decision(t.task_id,"DENY",["UNSUPPORTED_ACTION"],[],evaluatedAt);
  if (!c.authorities.includes(rule.required_authority))
    return decision(t.task_id,"DENY",["MISSING_TRUSTED_AUTHORIZATION"],[],evaluatedAt);
  const inScope = rule.target_types.includes(t.target.resource_type) &&
    c.allowed_targets.some(x => x.resource_type === t.target.resource_type && x.resource_id === t.target.resource_id);
  if (!inScope) return decision(t.task_id,"DENY",["TARGET_OUT_OF_SCOPE"],[],evaluatedAt);

  const records = [], seen = new Set(), notes = [];
  for (const raw of evidenceInput) {
    const e = validateEvidenceRecord(raw);
    if (!e.ok) { if (!notes.includes("INVALID_EVIDENCE_IGNORED")) notes.push("INVALID_EVIDENCE_IGNORED"); continue; }
    if (seen.has(e.value.evidence_id)) return decision(t.task_id,"DENY",["DUPLICATE_EVIDENCE_ID"],[],evaluatedAt);
    seen.add(e.value.evidence_id); records.push(e.value);
  }
  const used = [], failures = [];
  for (const req of t.required_evidence) {
    if (!req.required) continue;
    const matches = records.filter(e => e.result === "VERIFIED" && e.claim_type === req.claim_type && e.subject === req.subject);
    const found = req.revision === null ? matches[0] : matches.find(e => e.source.revision === req.revision);
    if (found) used.push(found.evidence_id);
    else failures.push(matches.length ? "EVIDENCE_REVISION_MISMATCH" : "MISSING_REQUIRED_EVIDENCE");
  }
  if (failures.length) return decision(t.task_id,"INSUFFICIENT_EVIDENCE",[...new Set(failures),...notes],[],evaluatedAt);
  return decision(t.task_id,"ALLOW",["ALL_CONDITIONS_SATISFIED",...notes],used,evaluatedAt);
}

export function isPolicyDecision(value) {
  return value && POLICY_DECISIONS.includes(value.decision);
}
