import { createHash } from "node:crypto";

const SHA = /^[0-9a-f]{40}$/;
const safePath = path => typeof path === "string" && path.length <= 512 && !path.startsWith("/") &&
  !path.includes("\\") && path.split("/").every(part => part && part !== "." && part !== "..");
const sensitivePath = path => /(^|\/)(\.env(?:\.|$)|credentials?(?:\.|$)|secrets?(?:\.|$)|id_rsa(?:\.pub)?$|[^/]+\.(?:pem|p12|pfx|key))|(^|\/)\.git\//i.test(path);

/** Injected read-only adapter; no write methods exist in this interface. */
export function createReadOnlyRepositoryIndexer({ readTree, readBlob, maxFiles = 500, maxBytes = 2_000_000 }) {
  if (typeof readTree !== "function" || typeof readBlob !== "function") throw new TypeError("READ_ONLY_REPOSITORY_ADAPTER_REQUIRED");
  return Object.freeze({ mode: "READ_ONLY", async index({ revision }) {
    if (!SHA.test(revision ?? "")) return { ok: false, reason: "IMMUTABLE_REVISION_REQUIRED" };
    const tree = await readTree({ revision });
    if (!Array.isArray(tree) || tree.length > maxFiles) return { ok: false, reason: "TREE_LIMIT_EXCEEDED" };
    const files = [];
    let totalBytes = 0;
    for (const entry of tree) {
      if (!safePath(entry?.path) || sensitivePath(entry.path) || entry.type !== "file" || !SHA.test(entry.blobSha ?? "")) continue;
      const content = await readBlob({ revision, path: entry.path, blobSha: entry.blobSha });
      if (typeof content !== "string") continue;
      const bytes = Buffer.byteLength(content, "utf8");
      if (totalBytes + bytes > maxBytes) return { ok: false, reason: "INDEX_BYTE_LIMIT_EXCEEDED" };
      totalBytes += bytes;
      files.push(Object.freeze({ path: entry.path, blobSha: entry.blobSha,
        contentDigest: `sha256:${createHash("sha256").update(content).digest("hex")}`, byteLength: bytes }));
    }
    return Object.freeze({ ok: true, revision, files: Object.freeze(files), totalBytes, externalTransfer: false });
  } });
}
