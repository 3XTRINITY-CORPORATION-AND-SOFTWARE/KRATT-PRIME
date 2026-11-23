import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PrimeStore } from "../../kratt-core/src/prime-store.mjs";
import { createWorkerLeaseCoordinator } from "../src/worker-lease-coordinator.mjs";

const taskDigest = `sha256:${"a".repeat(64)}`;
const fixture = () => ({ operationId: "acquire-1", reservationKey: "task-idem-1", taskDigest, ownerId: "worker-a", ttlMs: 5_000 });

async function withStore(run) {
  const dir = await mkdtemp(join(tmpdir(), "kratt-worker-lease-"));
  try { await run(join(dir, "leases.journal")); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test("lease coordinator persists an idempotent acquire and recovers the fencing state", async () => withStore(async path => {
  let current = "2026-11-11T12:00:00.000Z";
  const store = new PrimeStore({ path });
  const leases = createWorkerLeaseCoordinator({ store, now: () => current });
  const acquired = await leases.acquire(fixture());
  assert.equal(acquired.ok, true);
  assert.equal(acquired.fencingToken, 1);
  assert.equal(acquired.dispatch, false);
  assert.equal(acquired.executionStarted, false);
  const retry = await leases.acquire(fixture());
  assert.equal(retry.duplicate, true);
  assert.equal(retry.fencingToken, acquired.fencingToken);

  const recovered = createWorkerLeaseCoordinator({ store: new PrimeStore({ path }), now: () => current });
  const snapshot = await recovered.inspect("task-idem-1");
  assert.equal(snapshot.reservation.status, "LEASED");
  assert.equal(snapshot.reservation.lease.ownerId, "worker-a");
  assert.equal(snapshot.reservation.fence, 1);
}));

test("expired lease reacquisition advances fence and rejects the stale holder", async () => withStore(async path => {
  let current = "2026-11-11T12:00:00.000Z";
  const leases = createWorkerLeaseCoordinator({ store: new PrimeStore({ path }), now: () => current });
  const acquired = await leases.acquire(fixture());
  const blocked = await leases.acquire({ ...fixture(), operationId: "acquire-while-held" });
  assert.equal(blocked.reason, "WORKER_LEASE_HELD");

  current = "2026-11-11T12:00:05.000Z";
  const second = await leases.acquire({ ...fixture(), operationId: "acquire-2", ownerId: "worker-b" });
  assert.equal(second.ok, true);
  assert.equal(second.fencingToken, 2);
  const replay = await leases.acquire(fixture());
  assert.equal(replay.reason, "WORKER_LEASE_REPLAY_STALE");
  assert.equal("fencingToken" in replay, false);
  const stale = await leases.renew({ operationId: "renew-stale", reservationKey: "task-idem-1", taskDigest,
    ownerId: "worker-a", fencingToken: acquired.fencingToken, ttlMs: 5_000 });
  assert.equal(stale.reason, "WORKER_FENCING_TOKEN_STALE");
}));

test("separate coordinators sharing one store serialize acquisition", async () => withStore(async path => {
  const store = new PrimeStore({ path });
  const first = createWorkerLeaseCoordinator({ store, now: () => "2026-11-11T12:00:00.000Z" });
  const second = createWorkerLeaseCoordinator({ store, now: () => "2026-11-11T12:00:00.000Z" });
  const [left, right] = await Promise.all([
    first.acquire(fixture()),
    second.acquire({ ...fixture(), operationId: "acquire-from-second", ownerId: "worker-b" })
  ]);
  assert.equal([left, right].filter(result => result.ok).length, 1);
  assert.equal([left, right].find(result => !result.ok).reason, "WORKER_LEASE_HELD");
  assert.equal((await first.inspect("task-idem-1")).reservation.fence, 1);
}));

test("owner checks, payload binding, renew and release require the current fence", async () => withStore(async path => {
  let current = "2026-11-11T12:00:00.000Z";
  const leases = createWorkerLeaseCoordinator({ store: new PrimeStore({ path }), now: () => current });
  const acquired = await leases.acquire(fixture());
  const ownerMismatch = await leases.release({ operationId: "release-other", reservationKey: "task-idem-1", taskDigest,
    ownerId: "worker-b", fencingToken: acquired.fencingToken });
  assert.equal(ownerMismatch.reason, "WORKER_LEASE_OWNER_MISMATCH");
  const conflict = await leases.acquire({ ...fixture(), operationId: "acquire-conflict", taskDigest: `sha256:${"b".repeat(64)}` });
  assert.equal(conflict.reason, "WORKER_RESERVATION_PAYLOAD_CONFLICT");

  const renewed = await leases.renew({ operationId: "renew-1", reservationKey: "task-idem-1", taskDigest, ownerId: "worker-a",
    fencingToken: acquired.fencingToken, ttlMs: 8_000 });
  assert.equal(renewed.ok, true);
  assert.equal(renewed.fencingToken, acquired.fencingToken);
  assert.equal(renewed.expiresAt, "2026-11-11T12:00:08.000Z");
  const released = await leases.release({ operationId: "release-1", reservationKey: "task-idem-1", taskDigest,
    ownerId: "worker-a", fencingToken: acquired.fencingToken });
  assert.equal(released.state, "RELEASED");
  assert.equal((await leases.inspect("task-idem-1")).reservation.status, "AVAILABLE");
}));

test("operation IDs cannot be reused for different inputs and invalid TTLs fail closed", async () => withStore(async path => {
  const leases = createWorkerLeaseCoordinator({ store: new PrimeStore({ path }), now: () => "2026-11-11T12:00:00.000Z" });
  const first = await leases.acquire(fixture());
  assert.equal((await leases.acquire({ ...fixture(), ownerId: "worker-b" })).reason, "WORKER_LEASE_OPERATION_ID_REUSED");
  assert.equal((await leases.renew({ operationId: "bad-renew", reservationKey: "task-idem-1", taskDigest,
    ownerId: "worker-a", fencingToken: first.fencingToken, ttlMs: 900_000_000 })).reason, "WORKER_LEASE_TTL_INVALID");
  const renewed = await leases.renew({ operationId: "renew-idempotent", reservationKey: "task-idem-1", taskDigest,
    ownerId: "worker-a", fencingToken: first.fencingToken, ttlMs: 5_000 });
  assert.equal(renewed.ok, true);
  assert.equal((await leases.renew({ operationId: "renew-idempotent", reservationKey: "task-idem-1", taskDigest,
    ownerId: "worker-a", fencingToken: first.fencingToken, ttlMs: 7_000 })).reason, "WORKER_LEASE_OPERATION_ID_REUSED");
  assert.equal((await leases.acquire({ ...fixture(), operationId: "bad-ttl", ttlMs: 100 })).reason, "WORKER_LEASE_TTL_INVALID");
}));

test("exact operation input shape rejects getters without invoking them", async () => withStore(async path => {
  const leases = createWorkerLeaseCoordinator({ store: new PrimeStore({ path }), now: () => "2026-11-11T12:00:00.000Z" });
  let invoked = false;
  const request = fixture();
  Object.defineProperty(request, "ownerId", { get() { invoked = true; return "worker-a"; }, enumerable: true });
  const result = await leases.acquire(request);
  assert.equal(result.reason, "WORKER_LEASE_REQUEST_INVALID");
  assert.equal(invoked, false);
  const hostile = new Proxy(fixture(), { ownKeys() { throw new Error("hostile proxy"); } });
  assert.equal((await leases.acquire(hostile)).reason, "WORKER_LEASE_REQUEST_INVALID");
}));

test("lease status reports bounded aggregate counts without identifiers", async () => withStore(async path => {
  let current = "2026-11-11T12:00:00.000Z";
  const leases = createWorkerLeaseCoordinator({ store: new PrimeStore({ path }), now: () => current });
  await leases.acquire(fixture());
  const active = await leases.status();
  assert.deepEqual(active, { ok: true, reservationCount: 1, activeLeaseCount: 1, expiredLeaseCount: 0,
    availableReservationCount: 0, operationCount: 1, dispatch: false });
  assert.equal("reservationKey" in active, false);
  assert.equal("taskDigest" in active, false);
  assert.equal("ownerId" in active, false);
  current = "2026-11-11T12:00:05.000Z";
  const expired = await leases.status();
  assert.equal(expired.expiredLeaseCount, 1);
  assert.equal(expired.activeLeaseCount, 0);
}));

