import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const SHA = /^[0-9a-f]{40}$/;
const safePath = path => typeof path === "string" && path.length > 0 && path.length <= 512 &&
  !path.startsWith("/") && !path.includes("\\") && !path.includes("\0") &&
  path.split("/").every(part => part && part !== "." && part !== "..");

function runGit(repoPath, args, { timeoutMs, maxBufferBytes, runner }) {
  let result;
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
      ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
      ...(process.env.TMP ? { TMP: process.env.TMP } : {}),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_TERMINAL_PROMPT: "0",
      GIT_PAGER: "cat",
      PAGER: "cat"
    };
    result = runner("git", args, {
      cwd: repoPath,
      encoding: "buffer",
      timeout: timeoutMs,
      maxBuffer: maxBufferBytes,
      windowsHide: true,
      shell: false,
      env
    });
  } catch (error) {
    return { ok: false, reason: error?.code === "ETIMEDOUT" ? "GIT_TIMEOUT" : "GIT_UNAVAILABLE" };
  }
  if (result.error) return { ok: false, reason: result.error.code === "ETIMEDOUT" ? "GIT_TIMEOUT" :
    result.error.code === "ENOBUFS" ? "GIT_OUTPUT_LIMIT_EXCEEDED" : "GIT_UNAVAILABLE" };
  if (result.status !== 0) return { ok: false, reason: "GIT_READ_FAILED" };
  if (!Buffer.isBuffer(result.stdout)) return { ok: false, reason: "GIT_INVALID_OUTPUT" };
  return { ok: true, stdout: result.stdout };
}

/**
 * Build a local-only, read-only Git object source. It accepts no remotes, refs,
 * commands, or write operations from callers. Index only immutable commit SHAs.
 */
export function createLocalGitRepositorySource({ repoPath, timeoutMs = 5_000,
  maxTreeBytes = 4_000_000, maxBlobBytes = 2_000_000, runner = spawnSync } = {}) {
  if (typeof repoPath !== "string" || !repoPath.trim()) throw new TypeError("LOCAL_GIT_REPOSITORY_PATH_REQUIRED");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000 ||
      !Number.isInteger(maxTreeBytes) || maxTreeBytes < 1 || maxTreeBytes > 16_000_000 ||
      !Number.isInteger(maxBlobBytes) || maxBlobBytes < 1 || maxBlobBytes > 8_000_000) {
    throw new TypeError("LOCAL_GIT_LIMITS_INVALID");
  }
  const cwd = resolve(repoPath);
  const snapshots = new Map();

  return Object.freeze({ mode: "LOCAL_READ_ONLY", externalTransfer: false,
    async readTree({ revision }) {
      if (!SHA.test(revision ?? "")) throw new TypeError("IMMUTABLE_REVISION_REQUIRED");
      const result = runGit(cwd, ["ls-tree", "-r", "-z", "--full-tree", revision], { timeoutMs, maxBufferBytes: maxTreeBytes, runner });
      if (!result.ok) throw new Error(result.reason);
      const output = result.stdout;
      if (output.length > maxTreeBytes || (output.length && output[output.length - 1] !== 0)) throw new Error("GIT_TREE_LIMIT_OR_FORMAT");
      const tree = [];
      const blobs = new Map();
      for (const record of output.toString("utf8").split("\0").filter(Boolean)) {
        const separator = record.indexOf("\t");
        if (separator < 0) continue;
        const [mode, type, blobSha] = record.slice(0, separator).split(" ");
        const path = record.slice(separator + 1);
        if (type !== "blob" || !["100644", "100755"].includes(mode) || !SHA.test(blobSha ?? "") || !safePath(path)) continue;
        tree.push({ path, type: "file", blobSha });
        blobs.set(`${path}\0${blobSha}`, true);
      }
      snapshots.set(revision, blobs);
      return tree;
    },
    async readBlob({ revision, path, blobSha }) {
      if (!SHA.test(revision ?? "") || !SHA.test(blobSha ?? "") || !safePath(path)) throw new TypeError("INVALID_GIT_BLOB_REQUEST");
      if (!snapshots.get(revision)?.has(`${path}\0${blobSha}`)) throw new Error("BLOB_NOT_IN_PINNED_TREE");
      const result = runGit(cwd, ["cat-file", "blob", blobSha], { timeoutMs, maxBufferBytes: maxBlobBytes, runner });
      if (!result.ok) throw new Error(result.reason);
      if (result.stdout.length > maxBlobBytes) throw new Error("GIT_BLOB_LIMIT_EXCEEDED");
      const content = result.stdout.toString("utf8");
      if (!Buffer.from(content, "utf8").equals(result.stdout)) throw new Error("GIT_BLOB_NOT_UTF8");
      return content;
    }
  });
}

