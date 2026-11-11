import { randomUUID } from "node:crypto";
import { EvidenceLedger } from "../../packages/kratt-core/src/evidence-ledger.mjs";

const ACTOR_ID = "kratt-server";
const SAFE_REASON = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * In-memory demo adapter for server-generated intake decisions only.
 * Do not use as durable or production audit storage.
 */
export function createInMemoryAuditAdapter({ ledger = new EvidenceLedger(), now = () => new Date() } = {}) {
  return Object.freeze({
    recordIntakeDecision({ taskId, policy }) {
      if (typeof taskId !== "string" || !policy || !["ALLOW", "DENY", "BLOCKED"].includes(policy.decision)) {
        return { ok: false, reason: "AUDIT_INPUT_INVALID" };
      }
      const event = {
        schemaVersion: "kratt-evidence/v1",
        eventId: `intake-${randomUUID()}`,
        eventType: "task.intake.policy",
        actorId: ACTOR_ID,
        occurredAt: now().toISOString(),
        subject: taskId,
        decision: policy.decision === "ALLOW" ? "OBSERVED" : "BLOCKED",
        sourceRef: null,
        artifactDigest: null,
        metadata: {
          policyDecision: policy.decision,
          policyReason: typeof policy.reason === "string" && SAFE_REASON.test(policy.reason)
            ? policy.reason : "POLICY_EVALUATED",
          admitted: false,
          executionStarted: false
        }
      };
      const result = ledger.append(event);
      return result.ok ? Object.freeze({ ok: true, sequence: result.entry.sequence }) : result;
    },
    verify() {
      return ledger.verify();
    },
    get size() {
      return ledger.size;
    }
  });
}
