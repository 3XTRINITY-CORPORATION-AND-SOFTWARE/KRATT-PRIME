import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig } from "../src/config.mjs";
import { createLogger } from "../src/logger.mjs";
import { handleHealthRequest } from "../src/server.mjs";
import { createReadOnlyRepositoryIndexer } from "../src/repository-index.mjs";
import { createWorkerAdapter, proposePicoCloudRoute } from "../src/worker-contract.mjs";

test("configuration binds only to local interfaces and rejects unknown modes", () => {
  assert.equal(loadRuntimeConfig({}).host, "127.0.0.1");
  assert.throws(() => loadRuntimeConfig({ KRATT_HOST: "0.0.0.0" }), /loopback/);
  assert.throws(() => loadRuntimeConfig({ KRATT_RUNTIME_MODE: "cloud" }), /local runtime/);
  assert.throws(() => loadRuntimeConfig({ KRATT_PORT: "70000" }), /65535/);
});

test("structured logger filters sensitive field names and bounds primitive fields", () => {
  const lines = [];
  createLogger({ sink: line => lines.push(JSON.parse(line)) }).info("started user@example.com", { port: 4317, token: "do-not-log", nested: { token: "x" }, authorization: "Bearer abc" });
  assert.equal(lines[0].port, 4317);
  assert.equal(lines[0].message, "started [REDACTED]");
  assert.equal("token" in lines[0], false);
  assert.equal("nested" in lines[0], false);
  assert.equal("authorization" in lines[0], false);
});

test("health endpoints report liveness and readiness without exposing details", () => {
  const options = { logger: createLogger({ sink() {} }), readiness: () => ({ ready: false, checks: { store: "unavailable" } }) };
  assert.equal(handleHealthRequest({ method: "GET", url: "/health/live" }, options).status, 200);
  const ready = handleHealthRequest({ method: "GET", url: "/health/ready" }, options);
  assert.equal(ready.status, 503);
  assert.equal(ready.body.status, "not_ready");
  assert.equal(handleHealthRequest({ method: "POST", url: "/health/ready" }, options).status, 404);
});

test("repository index is pinned to immutable revisions, bounded, and has no write capability", async () => {
  const calls = [];
  const indexer = createReadOnlyRepositoryIndexer({ readTree: async () => [{ path: "src/a.mjs", type: "file", blobSha: "b".repeat(40) }, { path: "../secret", type: "file", blobSha: "c".repeat(40) }, { path: ".env", type: "file", blobSha: "d".repeat(40) }],
    readBlob: async args => { calls.push(args); return "module source"; } });
  assert.equal("write" in indexer, false);
  assert.equal((await indexer.index({ revision: "not-a-sha" })).reason, "IMMUTABLE_REVISION_REQUIRED");
  const result = await indexer.index({ revision: "a".repeat(40) });
  assert.equal(result.files.length, 1);
  assert.equal(result.externalTransfer, false);
  assert.equal(calls.length, 1);
});

test("worker and Pico-Cloud contracts stay describe-only and dry-run", async () => {
  assert.equal(proposePicoCloudRoute({ taskId: "job-1", inputDigest: `sha256:${"a".repeat(64)}`, target: "remote" }).dispatch, false);
  const worker = createWorkerAdapter({ describe: async request => ({ acceptedShape: request.taskId }) });
  const result = await worker.describe({ taskId: "job-1", deadlineMs: 100_000 });
  assert.equal(result.descriptor.acceptedShape, "job-1");
  assert.equal(result.executionStarted, false);
});
