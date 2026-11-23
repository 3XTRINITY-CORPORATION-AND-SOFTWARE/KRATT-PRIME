import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableEvidenceRepository } from "../src/durable-evidence.mjs";

const makeEvent = ({ eventId = "event-1", eventType = "source.checked", decision = "OBSERVED" } = {}) => ({
  rootId: "root-1", branchId: "research-1", eventId, eventType, actorId: "local-reviewer",
  occurredAt: "2026-11-10T10:00:00Z", subject: "root-1", decision,
  sourceRef: { provider: "git", resource: "README.md", revision: "a".repeat(40) },
  artifactDigest: `sha256:${"b".repeat(64)}`, metadata: { extraction: "test-fixture" }
});

async function withJournal(run) {
  const directory = await mkdtemp(join(tmpdir(), "kratt-evidence-"));
  try { await run(join(directory, "evidence.ndjson")); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test("durable repository appends, verifies and replays evidence across restarts", async () => withJournal(async path => {
  const repository = new DurableEvidenceRepository({ path });
  const written = await repository.append(makeEvent());
  assert.equal(written.ok, true);
  assert.equal(written.duplicate, false);
  assert.equal((await repository.verify()).eventCount, 1);

  const reopened = new DurableEvidenceRepository({ path });
  const listed = await reopened.list();
  assert.equal(listed.cards.length, 1);
  assert.equal(listed.cards[0].contentDigest, written.card.contentDigest);
  const status = await reopened.verify();
  assert.equal(status.ok, true);
  assert.equal(status.scope, "SINGLE_PROCESS_LOCAL_JOURNAL");
  assert.equal(status.encrypted, false);
  assert.equal(status.remoteSync, false);
}));

test("same ECK id and content is idempotent; same id with different content is rejected", async () => withJournal(async path => {
  const repository = new DurableEvidenceRepository({ path });
  assert.equal((await repository.append(makeEvent())).duplicate, false);
  assert.equal((await repository.append(makeEvent())).duplicate, true);
  const conflict = await repository.append(makeEvent({ eventType: "source.changed" }));
  assert.deepEqual(conflict, { ok: false, reason: "EVIDENCE_IDEMPOTENCY_CONFLICT" });
  assert.equal((await repository.list()).count, 1);
}));

test("invalid or sensitive evidence is rejected before journal write", async () => withJournal(async path => {
  const repository = new DurableEvidenceRepository({ path });
  const result = await repository.append({ ...makeEvent(), metadata: { accessToken: "secret" } });
  assert.equal(result.ok, false);
  assert.equal((await repository.list()).count, 0);
  await assert.rejects(readFile(path, "utf8"), error => error.code === "ENOENT");
}));

test("journal corruption blocks recovery instead of silently projecting a partial ledger", async () => withJournal(async path => {
  const repository = new DurableEvidenceRepository({ path });
  await repository.append(makeEvent());
  const journal = await readFile(path, "utf8");
  await writeFile(path, journal.replace('"decision":"OBSERVED"', '"decision":"BLOCKED"'));
  const reopened = new DurableEvidenceRepository({ path });
  await assert.rejects(reopened.open(), /STORE_JOURNAL_INTEGRITY_FAILURE/);
}));

test("an open repository detects later journal tampering during verification", async () => withJournal(async path => {
  const repository = new DurableEvidenceRepository({ path });
  await repository.append(makeEvent());
  const journal = await readFile(path, "utf8");
  await writeFile(path, journal.replace('"decision":"OBSERVED"', '"decision":"BLOCKED"'));
  await assert.rejects(repository.verify(), /STORE_JOURNAL_INTEGRITY_FAILURE/);
}));

test("repository requires exactly one explicit PrimeStore path or adapter", () => {
  assert.throws(() => new DurableEvidenceRepository(), /STORE_PATH_OR_ADAPTER_REQUIRED/);
  assert.throws(() => new DurableEvidenceRepository({ path: "a", store: {} }), /STORE_PATH_OR_ADAPTER_REQUIRED/);
});
