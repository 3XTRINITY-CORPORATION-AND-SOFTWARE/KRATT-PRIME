import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOperatorCli } from "../src/cli.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false, windowsHide: true,
    env: { PATH: process.env.PATH ?? "", ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_AUTHOR_NAME: "KRATT CLI test", GIT_AUTHOR_EMAIL: "test@example.invalid",
      GIT_COMMITTER_NAME: "KRATT CLI test", GIT_COMMITTER_EMAIL: "test@example.invalid" } });
  if (result.status !== 0) throw new Error(result.stderr || "git fixture failed");
  return result.stdout.trim();
}

function ioCapture() {
  const out = [], err = [];
  return { out, err, io: { stdout: { write: value => out.push(value) }, stderr: { write: value => err.push(value) } } };
}

test("CLI exposes help and rejects implicit writes or unknown options", async () => {
  const help = ioCapture();
  assert.equal(await runOperatorCli(["--help"], help.io), 0);
  assert.match(help.out.join(""), /read-only/);
  const invalid = ioCapture();
  assert.equal(await runOperatorCli(["index", "--repo", "relative"], invalid.io), 1);
  assert.match(invalid.err.join(""), /absolute paths/);
  const unknown = ioCapture();
  assert.equal(await runOperatorCli(["verify", "--journal", "C:\\temp\\journal", "--truncate", "yes"], unknown.io), 1);
  assert.match(unknown.err.join(""), /OPTION_UNKNOWN/);
  const serveArgs = ioCapture();
  assert.equal(await runOperatorCli(["serve", "--listen", "0.0.0.0"], serveArgs.io), 1);
  assert.match(serveArgs.err.join(""), /OPTION_UNKNOWN/);
});

test("CLI indexes a pinned local repository, safely replays and verifies its local journal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kratt-operator-cli-"));
  try {
    const repositoryPath = join(directory, "source");
    await mkdir(repositoryPath);
    await writeFile(join(repositoryPath, "README.md"), "A local test source.\n");
    await writeFile(join(repositoryPath, ".env"), "API_TOKEN=not-indexed\n");
    git(repositoryPath, ["init", "--quiet"]);
    git(repositoryPath, ["add", "--", "README.md", ".env"]);
    git(repositoryPath, ["commit", "--quiet", "-m", "fixture"]);
    const revision = git(repositoryPath, ["rev-parse", "HEAD"]);
    const journal = join(directory, "journal", "evidence.ndjson");
    const args = ["index", "--repo", repositoryPath, "--revision", revision, "--journal", journal,
      "--root-id", "cli-root", "--root-statement", "Inspect local fixture", "--branch-id", "cli-source",
      "--question", "What files are in the pinned revision?", "--actor-id", "local-cli",
      "--occurred-at", "2026-11-10T12:30:00Z"];

    const first = ioCapture();
    assert.equal(await runOperatorCli(args, first.io), 0);
    const firstResult = JSON.parse(first.out.join(""));
    assert.equal(firstResult.status, "PERSISTED");
    assert.equal(firstResult.indexedCount, 1);
    assert.equal(firstResult.persistedCount, 1);
    assert.equal(firstResult.externalTransfer, false);

    const replay = ioCapture();
    assert.equal(await runOperatorCli(args, replay.io), 0);
    assert.equal(JSON.parse(replay.out.join("")).duplicateCount, 1);

    const verified = ioCapture();
    assert.equal(await runOperatorCli(["verify", "--journal", journal], verified.io), 0);
    assert.equal(JSON.parse(verified.out.join("")).eventCount, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

