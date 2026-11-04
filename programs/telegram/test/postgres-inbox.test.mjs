import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresTelegramInbox } from "../src/adapters/postgres-inbox.mjs";

test("PostgreSQL inbox claims are atomic insert-or-eligible-retry operations", async () => {
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({ sql, values }); return { rowCount: 1 }; } };
  const inbox = createPostgresTelegramInbox(pool);
  assert.equal(await inbox.claim({ provider: "telegram", eventId: "42", payload: { update_id: 42 } }), true);
  assert.match(calls[0].sql, /ON CONFLICT \(provider, event_id\) DO UPDATE/);
  assert.equal(calls[0].values[1], "42");
  await inbox.complete({ provider: "telegram", eventId: "42" });
  assert.match(calls[1].sql, /status = 'PROCESSED'/);
  await inbox.fail({ provider: "telegram", eventId: "43", retryable: true });
  assert.match(calls[2].sql, /DEAD_LETTER/);
});

test("PostgreSQL inbox validates adapter configuration", () => {
  assert.throws(() => createPostgresTelegramInbox(null), /query client/);
  assert.throws(() => createPostgresTelegramInbox({ query() {} }, { maxAttempts: 0 }), /maxAttempts/);
});
