import test from "node:test";
import assert from "node:assert/strict";
import { aggregateCalibratedEvidence, createBranchManager, createEvidenceCard, createRootClaim, reflectEvidence } from "../src/evidence-kernel.mjs";

const revision = "a".repeat(40);
const event = (eventId, decision = "OBSERVED") => ({ rootId: "claim-1", branchId: "research",
  eventId, eventType: "source.reviewed", actorId: "reviewer-1", occurredAt: "2026-11-10T10:00:00Z",
  subject: "claim-1", decision, sourceRef: { provider: "paper", resource: "doi:example", revision: "v1" },
  artifactDigest: `sha256:${"b".repeat(64)}`, metadata: { method: "manual-review" } });

test("branch evidence retains root and source provenance and proposes no automatic update", () => {
  const root = createRootClaim({ rootId: "claim-1", statement: "A sample claim", revision });
  assert.equal(root.ok, true);
  const manager = createBranchManager(root.claim);
  const branch = manager.create({ branchId: "research", question: "Is the source relevant?" });
  assert.equal(branch.ok, true);
  const card = createEvidenceCard(event("ev-1"));
  assert.equal(card.ok, true);
  assert.equal(manager.addFinding("research", card.card).ok, true);
  const reflected = reflectEvidence({ rootClaim: root.claim, branches: manager.list(), requiredInvariants: [{ id: "provenance", passed: true }] });
  assert.equal(reflected.state, "VALIDATED");
  assert.equal(reflected.validatedDelta.autoApply, false);
});

test("reflection rejects findings remapped to a different canonical root", () => {
  const root = createRootClaim({ rootId: "claim-1", statement: "A sample claim", revision }).claim;
  const manager = createBranchManager(root);
  const branch = manager.create({ branchId: "research", question: "Check" }).branch;
  const card = createEvidenceCard(event("ev-2")).card;
  assert.equal(manager.addFinding("research", { ...card, rootId: "another-root" }).reason, "FINDING_PROVENANCE_MISMATCH");
  assert.equal(reflectEvidence({ rootClaim: root, branches: [{ ...branch, rootRevision: "c".repeat(40) }] }).state, "REJECTED");
});

test("Bayesian scaffold abstains without calibrated likelihoods and avoids multiplying dependent records", () => {
  assert.equal(aggregateCalibratedEvidence({ priorProbability: 0.5, observations: [{ likelihoodRatio: 5 }] }).status, "ABSTAIN");
  const result = aggregateCalibratedEvidence({ priorProbability: 0.5, observations: [
    { state: "CALIBRATED", calibrationId: "cal-1", dependencyGroup: "source-1", likelihoodRatio: 4 },
    { state: "CALIBRATED", calibrationId: "cal-2", dependencyGroup: "source-1", likelihoodRatio: 4 },
    { state: "CALIBRATED", calibrationId: "cal-3", dependencyGroup: "source-2", likelihoodRatio: 2 }
  ] });
  assert.equal(result.status, "AGGREGATED");
  assert.ok(Math.abs(result.posterior - 8 / 9) < 1e-12);
  assert.equal(result.usedGroups.length, 2);
});

test("dependent conflicting evidence is surfaced without a posterior", () => {
  const result = aggregateCalibratedEvidence({ priorProbability: 0.5, observations: [
    { state: "CALIBRATED", calibrationId: "cal-1", dependencyGroup: "same-source", likelihoodRatio: 2 },
    { state: "CALIBRATED", calibrationId: "cal-2", dependencyGroup: "same-source", likelihoodRatio: 0.5 }
  ] });
  assert.equal(result.status, "CONFLICTED");
  assert.equal(result.posterior, null);
});
