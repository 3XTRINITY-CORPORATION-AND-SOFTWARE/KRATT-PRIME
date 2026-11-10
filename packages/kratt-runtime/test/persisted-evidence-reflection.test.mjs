import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DurableEvidenceRepository } from "../src/durable-evidence.mjs";
import { createBranchManager, createRootClaim } from "../src/evidence-kernel.mjs";
import { reflectPersistedEvidence } from "../src/persisted-evidence-reflection.mjs";

const revision = "a".repeat(40);
const event = (eventId, decision = "OBSERVED", sourceRevision = revision) => ({ rootId: "reflection-root", branchId: "source-a",
  eventId, eventType: "repository.file.indexed", actorId: "test-indexer", occurredAt: "2026-11-10T12:00:00Z",
  subject: "repo-file:source:alpha", decision, sourceRef: { provider: "local-git", resource: "blob-" + eventId, revision: sourceRevision },
  artifactDigest: `sha256:${"b".repeat(64)}`, metadata: { path: "src/alpha.mjs", indexing: "metadata-only" } });

async function withRepo(run) {
  const root = await mkdtemp(join(tmpdir(), "kratt-reflection-"));
  try {
    const repository = new DurableEvidenceRepository({ path: join(root, `${randomUUID()}.journal`) });
    const claim = createRootClaim({ rootId: "reflection-root", statement: "Inspect pinned evidence", revision }).claim;
    const definition = { branchId: "source-a", question: "What does this repository revision contain?" };
    await repository.open();
    return await run({ repository, claim, definition, root });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("reflection rebuilds a stable branch snapshot from verified durable evidence", async () => withRepo(async ({ repository, claim, definition }) => {
  assert.equal((await repository.append(event("event-1"))).ok, true);
  const first = await reflectPersistedEvidence({ repository, rootClaim: claim, branchDefinitions: [definition] });
  const replay = await reflectPersistedEvidence({ repository, rootClaim: claim, branchDefinitions: [definition] });
  assert.equal(first.ok, true);
  assert.equal(first.status, "VALIDATED");
  assert.equal(first.snapshot.eventCount, 1);
  assert.equal(first.snapshot.branches[0].findings[0].cardId, "event-1");
  assert.equal(first.snapshot.reflection.validatedDelta.autoApply, false);
  assert.equal(first.snapshot.snapshotDigest, replay.snapshot.snapshotDigest);
  assert.ok(first.invariants.every(check => check.passed === true));
}));

test("reflection rejects repository evidence from a different pinned root revision", async () => withRepo(async ({ repository, claim, definition }) => {
  await repository.append(event("wrong-revision", "OBSERVED", "c".repeat(40)));
  const result = await reflectPersistedEvidence({ repository, rootClaim: claim, branchDefinitions: [definition] });
  assert.equal(result.ok, false);
  assert.equal(result.status, "REJECTED");
  assert.equal(result.reason, "REPOSITORY_REVISION_MISMATCH");
  assert.equal(result.invariants.find(item => item.id === "REPOSITORY_REVISION_PINNED").passed, false);
}));

test("reflection identifies conflicting decisions across persisted branches", async () => withRepo(async ({ repository, claim, definition }) => {
  const manager = createBranchManager(claim);
  manager.create(definition);
  manager.create({ branchId: "source-b", question: "Independently check the same assertion?" });
  await repository.append(event("verified", "VERIFIED"));
  await repository.append({ ...event("blocked", "BLOCKED"), branchId: "source-b" });
  const result = await reflectPersistedEvidence({ repository, rootClaim: claim,
    branchDefinitions: [definition, { branchId: "source-b", question: "Independently check the same assertion?" }] });
  assert.equal(result.ok, false);
  assert.equal(result.status, "CONFLICTED");
  assert.equal(result.snapshot.reflection.validatedDelta, null);
}));

test("reflection rejects a journal that changes while pages are being read", async () => withRepo(async ({ repository, claim, definition }) => {
  await repository.append(event("stable-first"));
  let calls = 0;
  const changingRepository = {
    verify: async () => {
      calls += 1;
      if (calls === 2) await repository.append(event("late-arrival"));
      return repository.verify();
    },
    list: args => repository.list(args)
  };
  const result = await reflectPersistedEvidence({ repository: changingRepository, rootClaim: claim, branchDefinitions: [definition] });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "JOURNAL_CHANGED_DURING_REFLECTION");
  assert.equal(result.invariants.find(item => item.id === "JOURNAL_VERIFIED").passed, false);
}));

