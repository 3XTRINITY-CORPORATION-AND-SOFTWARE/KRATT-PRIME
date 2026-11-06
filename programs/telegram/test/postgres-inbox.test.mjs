import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresTelegramInbox } from "../src/adapters/postgres-inbox.mjs";

test("PostgreSQL inbox returns a unique lease token and fences completion/failure", async () => {
  const calls = [];
  const pool = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("RETURNING event_id, lease_token")) return { rowCount: 1, rows: [{ event_id: "42", lease_token: values[5] }] };
    return { rowCount: 1, rows: [] };
  }};
  const inbox = createPostgresTelegramInbox(pool);
  const claim = await inbox.claim({ provider: "telegram", eventId: "42", payload: { update_id: 42 } });
  assert.equal(claim.claimed, true);
  assert.equal(typeof claim.leaseToken, "string");
  assert.match(calls[0].sql, /ON CONFLICT \(provider, event_id\) DO UPDATE/);
  assert.match(calls[0].sql, /lease_token = EXCLUDED\.lease_token/);
  assert.equal(calls[0].values[1], "42");

  await inbox.complete({ provider: "telegram", eventId: "42", leaseToken: claim.leaseToken });
  assert.match(calls[1].sql, /lease_token = \$3/);
  assert.match(calls[1].sql, /lease_token = NULL/);
  assert.match(calls[1].sql, /locked_at >= now/);

  await inbox.fail({ provider: "telegram", eventId: "43", leaseToken: "lease-43", retryable: true });
  assert.match(calls[2].sql, /lease_token = \$3/);
  assert.match(calls[2].sql, /DEAD_LETTER/);
  assert.match(calls[2].sql, /locked_at >= now/);
});

test("PostgreSQL inbox validates adapter configuration and lease tokens", async () => {
  assert.throws(() => createPostgresTelegramInbox(null), /query client/);
  assert.throws(() => createPostgresTelegramInbox({ query() {} }, { maxAttempts: 0 }), /maxAttempts/);
  const inbox = createPostgresTelegramInbox({ query: async () => ({ rowCount: 0, rows: [] }) });
  await assert.rejects(inbox.complete({ provider: "telegram", eventId: "42" }), /lease token/);
  await assert.rejects(inbox.fail({ provider: "telegram", eventId: "42" }), /lease token/);
});

test("an expired or superseded worker cannot complete or fail a claimed event", async () => {
  const pool = { query: async () => ({ rowCount: 0, rows: [] }) };
  const inbox = createPostgresTelegramInbox(pool, { leaseSeconds: 60 });
  await assert.rejects(
    inbox.complete({ provider: "telegram", eventId: "42", leaseToken: "old-lease" }),
    /INBOX_COMPLETE_LEASE_CONFLICT/
  );
  await assert.rejects(
    inbox.fail({ provider: "telegram", eventId: "42", leaseToken: "old-lease" }),
    /INBOX_FAIL_LEASE_CONFLICT/
  );
});
