import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig } from "../src/config.mjs";
import { createLogger } from "../src/logger.mjs";
import { createRuntimeServer, handleHealthRequest, handleOperatorRequest } from "../src/server.mjs";
import { resolve } from "node:path";
import { createReadOnlyRepositoryIndexer } from "../src/repository-index.mjs";
import { createWorkerAdapter, proposePicoCloudRoute } from "../src/worker-contract.mjs";

test("configuration binds only to local interfaces and rejects unknown modes", () => {
  assert.equal(loadRuntimeConfig({}).host, "127.0.0.1");
  assert.equal(loadRuntimeConfig({}).journalPath, null);
  assert.equal(loadRuntimeConfig({}).leaseJournalPath, null);
  assert.throws(() => loadRuntimeConfig({ KRATT_HOST: "0.0.0.0" }), /loopback/);
  assert.throws(() => loadRuntimeConfig({ KRATT_RUNTIME_MODE: "cloud" }), /local runtime/);
  assert.throws(() => loadRuntimeConfig({ KRATT_PORT: "70000" }), /65535/);
  assert.throws(() => loadRuntimeConfig({ KRATT_JOURNAL_PATH: "relative/journal" }), /absolute local path/);
  assert.throws(() => loadRuntimeConfig({ KRATT_LEASE_JOURNAL_PATH: "relative/leases" }), /absolute local path/);
  assert.equal(loadRuntimeConfig({ KRATT_JOURNAL_PATH: resolve("journal.ndjson") }).journalPath, resolve("journal.ndjson"));
  assert.equal(loadRuntimeConfig({ KRATT_LEASE_JOURNAL_PATH: resolve("leases.ndjson") }).leaseJournalPath, resolve("leases.ndjson"));
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

test("operator API is read-only, bounded, loopback-only and omits repository paths", async () => {
  const repository = {
    async verify() { return { ok: true, schemaVersion: "kratt-durable-evidence/v1", eventCount: 1,
      evidenceHeadHash: "a".repeat(64), journalEntries: 1, journalHeadHash: "b".repeat(64),
      encrypted: false, remoteSync: false, scope: "SINGLE_PROCESS_LOCAL_JOURNAL" }; },
    async list(args) { return { ok: true, count: 1, cards: [{ schemaVersion: "kratt-eck-card/v1", cardId: "card-1", rootId: "root-1", branchId: "branch-1",
      evidence: { occurredAt: "2026-11-10T12:00:00Z", eventType: "repository.file.indexed", subject: "repo-file:abc", decision: "OBSERVED",
        actorId: "private-actor", sourceRef: { provider: "local-git", resource: "a".repeat(40), revision: "b".repeat(40) },
        artifactDigest: `sha256:${"c".repeat(64)}`, metadata: { path: "private/repo/local/path.mjs" } } }], args }; }
  };
  const response = await handleOperatorRequest({ method: "GET", url: "/evidence?after=0&limit=10" }, { evidenceRepository: repository });
  assert.equal(response.status, 200);
  assert.equal(response.body.cards.length, 1);
  assert.equal("metadata" in response.body.cards[0], false);
  assert.equal("actorId" in response.body.cards[0], false);
  assert.equal(JSON.stringify(response.body).includes("private/repo"), false);
  assert.equal((await handleOperatorRequest({ method: "GET", url: "/evidence?limit=101" }, { evidenceRepository: repository })).status, 400);
  assert.equal((await handleOperatorRequest({ method: "GET", url: "/evidence?after=0&after=1" }, { evidenceRepository: repository })).status, 400);
  const denied = await handleOperatorRequest({ method: "POST", url: "/evidence/verify" }, { evidenceRepository: repository });
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.allow, "GET");
  const ready = await handleOperatorRequest({ method: "GET", url: "/health/ready" }, { evidenceRepository: repository,
    readiness: async () => ({ ready: true, checks: { evidenceJournal: "ok" } }) });
  assert.equal(ready.status, 200);
  assert.throws(() => createRuntimeServer({ config: { host: "0.0.0.0", port: 4317 } }), /LOOPBACK_BIND_REQUIRED/);
  const leaseCoordinator = { async status() { return { ok: true, reservationCount: 3, activeLeaseCount: 1, expiredLeaseCount: 1,
    availableReservationCount: 1, operationCount: 9, dispatch: false, ownerId: "private-owner", taskDigest: `sha256:${"a".repeat(64)}` }; } };
  const leaseStatus = await handleOperatorRequest({ method: "GET", url: "/leases/status" }, { leaseCoordinator });
  assert.equal(leaseStatus.status, 200);
  assert.equal(leaseStatus.body.activeLeaseCount, 1);
  assert.equal("ownerId" in leaseStatus.body, false);
  assert.equal("taskDigest" in leaseStatus.body, false);
  assert.equal("reservationKey" in leaseStatus.body, false);
  assert.equal((await handleOperatorRequest({ method: "GET", url: "/leases/status?owner=private-owner" }, { leaseCoordinator })).status, 400);
  const hidden = await handleOperatorRequest({ method: "GET", url: "/leases/status" });
  assert.equal(hidden.status, 503);
  assert.equal((await handleOperatorRequest({ method: "POST", url: "/leases/status" }, { leaseCoordinator })).status, 405);
});

test("runtime server serves the inspection API only on loopback", async () => {
  const repository = { async verify() { return { ok: true, schemaVersion: "kratt-durable-evidence/v1", eventCount: 0,
    evidenceHeadHash: "0".repeat(64), journalEntries: 0, journalHeadHash: "0".repeat(64),
    encrypted: false, remoteSync: false, scope: "SINGLE_PROCESS_LOCAL_JOURNAL" }; },
  async list() { return { ok: true, count: 0, cards: [] }; } };
  const leaseCoordinator = { async status() { return { ok: true, reservationCount: 2, activeLeaseCount: 1, expiredLeaseCount: 0,
    availableReservationCount: 1, operationCount: 3, dispatch: false }; } };
  const runtime = createRuntimeServer({ config: { host: "127.0.0.1", port: 0 }, evidenceRepository: repository, leaseCoordinator });
  try {
    const address = await runtime.listen();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/evidence?limit=10`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await response.json()).count, 0);
    const leases = await fetch(`${baseUrl}/leases/status`);
    assert.equal(leases.status, 200);
    assert.equal((await leases.json()).activeLeaseCount, 1);
    const ready = await fetch(`${baseUrl}/health/ready`);
    assert.deepEqual((await ready.json()).checks, { evidenceJournal: "ok", leaseJournal: "ok" });
    const denied = await fetch(`${baseUrl}/evidence/verify`, { method: "POST" });
    assert.equal(denied.status, 405);
    assert.equal(denied.headers.get("allow"), "GET");
  } finally {
    await runtime.close();
  }
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
  const remote = proposePicoCloudRoute({ taskId: "job-1", inputDigest: `sha256:${"a".repeat(64)}`, target: "remote", dataTransferApproved: true });
  assert.equal(remote.dispatch, false);
  assert.equal(remote.state, "BLOCKED");
  const worker = createWorkerAdapter({ describe: async request => ({ acceptedShape: request.taskId }) });
  assert.equal((await worker.describe({ taskId: "job-1", deadlineMs: 100_000 })).reason, "WORKER_DEADLINE_INVALID");
  const result = await worker.describe({ taskId: "job-1", deadlineMs: 30_000 });
  assert.equal(result.descriptor.acceptedShape, "job-1");
  assert.equal(result.executionStarted, false);
});



