import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalEvidenceJson } from "../../kratt-core/src/evidence-ledger.mjs";
import { createWorkerProposal, recordWorkerProposal } from "../src/worker-proposal.mjs";
import { DurableEvidenceRepository } from "../src/durable-evidence.mjs";
import { createHash } from "node:crypto";

const digest = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
function fixture(overrides = {}) {
  const task = { schemaVersion: "kratt-worker-task/v1", taskId: "task-1", inputDigest: digest("private payload"),
    target: "local", dataClass: "INTERNAL", requiredCapabilities: ["evidence:inspect"], idempotencyKey: "idem-1",
    deadline: "2026-11-11T12:05:00Z", maxCostUnits: 2, maxDurationMs: 10_000, ...overrides.task };
  const worker = { schemaVersion: "kratt-worker-profile/v1", workerId: "worker-1", mode: "DESCRIBE_ONLY",
    targets: ["local", "remote"], dataClasses: ["PUBLIC", "INTERNAL"], capabilities: ["evidence:inspect"],
    maxCostUnits: 5, maxDurationMs: 30_000, ...overrides.worker };
  const trustedContext = { schemaVersion: "kratt-worker-trusted-context/v1", actorId: "actor-1",
    principalScopes: ["evidence:inspect"], agentScopes: ["evidence:inspect"], taskScopes: ["evidence:inspect"],
    now: "2026-11-11T12:00:00Z", globalKillSwitch: false, maxCostUnits: 10, ...overrides.trustedContext };
  return { task, worker, trustedContext, ...overrides.rest };
}

test("local worker proposals intersect capabilities and never dispatch", async () => {
  const result = await createWorkerProposal(fixture());
  assert.equal(result.ok, true);
  assert.equal(result.state, "PROPOSED");
  assert.equal(result.reason, "WORKER_EXECUTION_NOT_IMPLEMENTED");
  assert.deepEqual(result.effectiveCapabilities, ["evidence:inspect"]);
  assert.equal(result.dispatch, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.externalEffects, false);
});

test("worker admission fails closed for kill switch, expiry, scope and budgets", async () => {
  assert.equal((await createWorkerProposal(fixture({ trustedContext: { globalKillSwitch: true } }))).reason, "GLOBAL_KILL_SWITCH_ENABLED");
  assert.equal((await createWorkerProposal(fixture({ task: { deadline: "2026-11-11T11:59:00Z" } }))).reason, "TASK_DEADLINE_EXPIRED");
  assert.equal((await createWorkerProposal(fixture({ worker: { capabilities: [] } }))).reason, "WORKER_CAPABILITY_SCOPE_INSUFFICIENT");
  assert.equal((await createWorkerProposal(fixture({ task: { maxCostUnits: 8 } }))).reason, "WORKER_COST_BUDGET_EXCEEDED");
  assert.equal((await createWorkerProposal(fixture({ task: { maxDurationMs: 40_000 } }))).reason, "WORKER_TIME_BUDGET_EXCEEDED");
});

test("remote proposal needs proof bound to the exact task and still cannot dispatch", async () => {
  const input = fixture({ task: { target: "remote", dataClass: "INTERNAL" } });
  assert.equal((await createWorkerProposal(input)).reason, "VERIFIED_EXACT_TRANSFER_CONSENT_REQUIRED");
  const taskDigest = digest(canonicalEvidenceJson(input.task));
  const common = { actorId: "actor-1", taskDigest, workerId: "worker-1", target: "remote", dataClass: "INTERNAL",
    issuedAt: "2026-11-11T12:00:00Z", expiresAt: "2026-11-11T12:10:00Z", nonce: "nonce-1", keyId: "key-1", signature: "x".repeat(32) };
  input.consent = { schemaVersion: "kratt-data-transfer-consent/v1", consentId: "consent-1", ...common };
  input.approval = { schemaVersion: "kratt-worker-dispatch-approval/v1", approvalId: "approval-1", ...common };
  input.verifyConsent = async (_proof, binding) => binding.actorId === "actor-1";
  input.verifyApproval = async () => true;
  const result = await createWorkerProposal(input);
  assert.equal(result.state, "PROPOSED");
  assert.equal(result.dispatch, false);
  assert.equal(result.executionStarted, false);
  assert.equal(result.externalEffects, false);
  assert.deepEqual(result.approvalIds, ["consent-1", "approval-1"]);
  input.approval = { ...input.approval, actorId: "other-actor" };
  assert.equal((await createWorkerProposal(input)).reason, "VERIFIED_EXACT_WORKER_APPROVAL_REQUIRED");
});

test("audit stores metadata only and exact proposal retries are idempotent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kratt-worker-audit-"));
  const path = join(dir, "evidence.journal");
  try {
    const repository = new DurableEvidenceRepository({ path });
    const proposal = await createWorkerProposal(fixture());
    const args = { repository, proposal, rootId: "root-1", branchId: "branch-1", actorId: "actor-1", occurredAt: "2026-11-11T12:00:00Z" };
    const first = await recordWorkerProposal(args);
    const second = await recordWorkerProposal(args);
    assert.equal(first.ok, true);
    assert.equal(second.duplicate, true);
    const listed = await repository.list({ after: 0, limit: 10 });
    assert.equal(listed.cards.length, 1);
    const journal = await readFile(path, "utf8");
    assert.equal(journal.includes("private payload"), false);
    assert.equal(journal.includes("signature"), false);
    assert.equal(journal.includes("approvalIds"), false);
    assert.equal(journal.includes(proposal.planDigest), true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

