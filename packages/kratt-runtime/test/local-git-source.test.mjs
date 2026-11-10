import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createLocalGitRepositorySource } from "../src/local-git-source.mjs";
import { createReadOnlyRepositoryIndexer } from "../src/repository-index.mjs";
import { createBranchManager, createRepositoryEvidenceCards, createRootClaim } from "../src/evidence-kernel.mjs";

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
    await writeFile(join(root, ".env"), "API_TOKEN=never-index\n");
    git(root, ["init", "--quiet"]);
    git(root, ["add", "--", "src/sample.mjs", ".env"]);
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
  assert.deepEqual(result.files.map(file => file.path), ["src/sample.mjs"]);
  assert.equal("content" in result.files[0], false);
  assert.equal(result.externalTransfer, false);
  const root = createRootClaim({ rootId: "repo-review", statement: "Inspect pinned repository source", revision });
  const manager = createBranchManager(root.claim);
  manager.create({ branchId: "local-index", question: "Which files are present at this revision?" });
  const evidence = createRepositoryEvidenceCards({ index: result, rootId: "repo-review", branchId: "local-index",
    actorId: "local-indexer", occurredAt: "2026-11-10T10:00:00Z" });
  assert.equal(evidence.ok, true);
  assert.equal(evidence.cards.length, 1);
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

