import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createLocalGitRepositorySource } from "../src/local-git-source.mjs";
import { createReadOnlyRepositoryIndexer } from "../src/repository-index.mjs";
import { createBranchManager, createRepositoryEvidenceCards, createRootClaim } from "../src/evidence-kernel.mjs";
import { DurableEvidenceRepository } from "../src/durable-evidence.mjs";
import { persistRepositoryIndexEvidence } from "../src/repository-evidence-pipeline.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, shell: false,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "KRATT test", GIT_AUTHOR_EMAIL: "test@example.invalid",
      GIT_COMMITTER_NAME: "KRATT test", GIT_COMMITTER_EMAIL: "test@example.invalid" } });
  if (result.status !== 0) throw new Error(result.stderr || "git fixture failed");
  return result.stdout.trim();
}

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "kratt-local-git-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "sample.mjs"), "export const evidence = 'local';\n");
    await writeFile(join(root, "src", "second.txt"), "A second pinned source file.\n");
    await writeFile(join(root, ".env"), "API_TOKEN=never-index\n");
    git(root, ["init", "--quiet"]);
    git(root, ["add", "--", "src/sample.mjs", "src/second.txt", ".env"]);
    git(root, ["commit", "--quiet", "-m", "fixture"]);
    const revision = git(root, ["rev-parse", "HEAD"]);
    return await run(root, revision);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("local Git source reads only blobs pinned to an immutable commit", async () => fixture(async (repoPath, revision) => {
  const source = createLocalGitRepositorySource({ repoPath });
  const tree = await source.readTree({ revision });
  assert.equal(source.mode, "LOCAL_READ_ONLY");
  assert.equal(source.externalTransfer, false);
  assert.ok(tree.some(file => file.path === "src/sample.mjs"));
  const file = tree.find(entry => entry.path === "src/sample.mjs");
  assert.equal(await source.readBlob({ revision, path: file.path, blobSha: file.blobSha }), "export const evidence = 'local';\n");
  await assert.rejects(source.readBlob({ revision, path: "src/other.mjs", blobSha: file.blobSha }), /BLOB_NOT_IN_PINNED_TREE/);
  await assert.rejects(source.readTree({ revision: "HEAD" }), /IMMUTABLE_REVISION_REQUIRED/);
}));

test("local source composes with ECK repository indexing without returning file contents", async () => fixture(async (repoPath, revision) => {
  const source = createLocalGitRepositorySource({ repoPath });
  const indexer = createReadOnlyRepositoryIndexer(source);
  const result = await indexer.index({ revision });
  assert.equal(result.ok, true);
  assert.deepEqual(result.files.map(file => file.path), ["src/sample.mjs", "src/second.txt"]);
  assert.equal("content" in result.files[0], false);
  assert.equal(result.externalTransfer, false);
  const root = createRootClaim({ rootId: "repo-review", statement: "Inspect pinned repository source", revision });
  const manager = createBranchManager(root.claim);
  manager.create({ branchId: "local-index", question: "Which files are present at this revision?" });
  const evidence = createRepositoryEvidenceCards({ index: result, rootId: "repo-review", branchId: "local-index",
    actorId: "local-indexer", occurredAt: "2026-11-10T10:00:00Z" });
  assert.equal(evidence.ok, true);
  assert.equal(evidence.cards.length, 2);
  const otherBranchEvidence = createRepositoryEvidenceCards({ index: result, rootId: "repo-review", branchId: "second-index",
    actorId: "local-indexer", occurredAt: "2026-11-10T10:00:00Z" });
  assert.equal(otherBranchEvidence.ok, true);
  assert.notEqual(evidence.cards[0].cardId, otherBranchEvidence.cards[0].cardId);
  assert.equal(manager.addFinding("local-index", evidence.cards[0]).ok, true);
  assert.equal(manager.list()[0].findings[0].evidence.sourceRef.revision, revision);
}));

test("Git source command execution is shell-free and output-budgeted", async () => {
  const calls = [];
  const source = createLocalGitRepositorySource({ repoPath: process.cwd(), maxTreeBytes: 32,
    runner: (command, args, options) => {
      calls.push({ command, args, shell: options.shell, maxBuffer: options.maxBuffer, env: options.env });
      return { status: 0, stdout: Buffer.from("x".repeat(33)), stderr: Buffer.alloc(0) };
    } });
  await assert.rejects(source.readTree({ revision: "a".repeat(40) }), /GIT_TREE_LIMIT_OR_FORMAT/);
  assert.equal(calls[0].command, "git");
  assert.equal(calls[0].shell, false);
  assert.equal(calls[0].maxBuffer, 32);
  assert.equal("GITHUB_TOKEN" in calls[0].env, false);
  assert.equal(calls[0].env.GIT_NO_REPLACE_OBJECTS, "1");
  assert.ok(calls[0].args.every(arg => !/[;&|`$]/.test(arg)));
});

test("repository index evidence is durably appended and exact retries are idempotent", async () => fixture(async (repoPath, revision) => {
  const storage = await mkdtemp(join(tmpdir(), "kratt-evidence-journal-"));
  try {
    const root = createRootClaim({ rootId: "persist-review", statement: "Record pinned repository files", revision }).claim;
    const branch = createBranchManager(root).create({ branchId: "durable-index", question: "What files exist in this snapshot?" }).branch;
    const indexer = createReadOnlyRepositoryIndexer(createLocalGitRepositorySource({ repoPath }));
    const repository = new DurableEvidenceRepository({ path: join(storage, `${randomUUID()}.journal`) });
    const request = { indexer, repository, rootClaim: root, branch, actorId: "local-indexer", occurredAt: "2026-11-10T11:00:00Z" };
    const first = await persistRepositoryIndexEvidence(request);
    assert.equal(first.ok, true);
    assert.equal(first.persistedCount, 2);
    assert.equal(first.duplicateCount, 0);
    assert.equal(first.externalTransfer, false);
    const replay = await persistRepositoryIndexEvidence(request);
    assert.equal(replay.ok, true);
    assert.equal(replay.persistedCount, 2);
    assert.equal(replay.duplicateCount, 2);
    const verified = await repository.verify();
    assert.equal(verified.ok, true);
    assert.equal(verified.eventCount, 2);
  } finally {
    await rm(storage, { recursive: true, force: true });
  }
}));

test("partial evidence persistence is explicit and safe to resume with identical inputs", async () => fixture(async (repoPath, revision) => {
  const storage = await mkdtemp(join(tmpdir(), "kratt-evidence-journal-"));
  try {
    const root = createRootClaim({ rootId: "partial-review", statement: "Record pinned repository files", revision }).claim;
    const branch = createBranchManager(root).create({ branchId: "partial-index", question: "What files exist in this snapshot?" }).branch;
    const indexer = createReadOnlyRepositoryIndexer(createLocalGitRepositorySource({ repoPath }));
    const repository = new DurableEvidenceRepository({ path: join(storage, `${randomUUID()}.journal`) });
    let calls = 0;
    const interruptedRepository = { append: async event => {
      calls += 1;
      if (calls === 2) return { ok: false, reason: "INJECTED_STORAGE_FAILURE" };
      return repository.append(event);
    } };
    const request = { indexer, repository: interruptedRepository, rootClaim: root, branch, actorId: "local-indexer", occurredAt: "2026-11-10T11:01:00Z" };
    const interrupted = await persistRepositoryIndexEvidence(request);
    assert.equal(interrupted.status, "PARTIAL");
    assert.equal(interrupted.persistedCount, 1);
    assert.equal(interrupted.retry, "REPEAT_WITH_IDENTICAL_ROOT_BRANCH_ACTOR_TIME_AND_REVISION");
    const resumed = await persistRepositoryIndexEvidence({ ...request, repository });
    assert.equal(resumed.ok, true);
    assert.equal(resumed.duplicateCount, 1);
    assert.equal(resumed.persistedCount, 2);
    assert.equal((await repository.verify()).eventCount, 2);
  } finally {
    await rm(storage, { recursive: true, force: true });
  }
}));


