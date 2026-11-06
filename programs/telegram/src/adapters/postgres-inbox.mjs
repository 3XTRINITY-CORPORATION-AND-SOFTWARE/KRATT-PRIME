import { randomUUID } from "node:crypto";

/**
 * PostgreSQL-backed Telegram event inbox with lease fencing.
 * A claim returns a unique lease token. Complete/fail must present the token,
 * so a worker whose lease expired cannot mutate a later worker's claim.
 */
export function createPostgresTelegramInbox(pool, { maxAttempts = 8, leaseSeconds = 300 } = {}) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("A PostgreSQL-compatible query client is required");
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) throw new TypeError("maxAttempts must be a positive integer");
  if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 30) throw new TypeError("leaseSeconds must be at least 30");

  return Object.freeze({
    async claim({ provider, eventId, payload }) {
      const leaseToken = randomUUID();
      const result = await pool.query(
        `INSERT INTO telegram_event_inbox
           (provider, event_id, payload, status, attempt_count, locked_at, lease_token, next_attempt_at)
         VALUES ($1, $2, $3::jsonb, 'PROCESSING', 1, now(), $6, now())
         ON CONFLICT (provider, event_id) DO UPDATE
           SET status = 'PROCESSING',
               attempt_count = telegram_event_inbox.attempt_count + 1,
               locked_at = now(),
               lease_token = EXCLUDED.lease_token,
               next_attempt_at = now(),
               updated_at = now()
         WHERE
           (telegram_event_inbox.status = 'FAILED' AND telegram_event_inbox.next_attempt_at <= now()
             AND telegram_event_inbox.attempt_count < $4)
           OR
           (telegram_event_inbox.status = 'PROCESSING'
             AND telegram_event_inbox.locked_at < now() - ($5::int * interval '1 second')
             AND telegram_event_inbox.attempt_count < $4)
         RETURNING event_id, lease_token`,
        [provider, eventId, JSON.stringify(payload), maxAttempts, leaseSeconds, leaseToken]
      );
      const row = result.rows?.[0];
      return row?.lease_token ? Object.freeze({ claimed:true, leaseToken:row.lease_token }) : null;
    },

    async complete({ provider, eventId, leaseToken }) {
      if (typeof leaseToken !== "string" || !leaseToken) throw new TypeError("A valid inbox lease token is required");
      const result = await pool.query(
        `UPDATE telegram_event_inbox
           SET status = 'PROCESSED', processed_at = now(), locked_at = NULL,
               lease_token = NULL, updated_at = now()
         WHERE provider = $1 AND event_id = $2 AND status = 'PROCESSING' AND lease_token = $3
           AND locked_at >= now() - ($4::int * interval '1 second')`,
        [provider, eventId, leaseToken, leaseSeconds]
      );
      if (result.rowCount !== 1) throw new Error("INBOX_COMPLETE_LEASE_CONFLICT");
    },

    async fail({ provider, eventId, leaseToken, retryable = true }) {
      if (typeof leaseToken !== "string" || !leaseToken) throw new TypeError("A valid inbox lease token is required");
      const result = await pool.query(
        `UPDATE telegram_event_inbox
           SET status = CASE WHEN NOT $4 OR attempt_count >= $5 THEN 'DEAD_LETTER' ELSE 'FAILED' END,
               locked_at = NULL,
               lease_token = NULL,
               next_attempt_at = CASE
                 WHEN NOT $4 OR attempt_count >= $5 THEN NULL
                 ELSE now() + (LEAST(3600, power(2, LEAST(attempt_count, 11))::int) * interval '1 second')
               END,
               updated_at = now()
         WHERE provider = $1 AND event_id = $2 AND status = 'PROCESSING' AND lease_token = $3
           AND locked_at >= now() - ($6::int * interval '1 second')`,
        [provider, eventId, leaseToken, retryable, maxAttempts, leaseSeconds]
      );
      if (result.rowCount !== 1) throw new Error("INBOX_FAIL_LEASE_CONFLICT");
    }
  });
}
