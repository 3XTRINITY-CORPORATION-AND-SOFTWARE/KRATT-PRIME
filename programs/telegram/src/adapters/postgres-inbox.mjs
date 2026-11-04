/**
 * PostgreSQL-backed Telegram event inbox.
 * Requires a pool/client exposing query(text, values). Run migrations/001_telegram_inbox.sql first.
 */
export function createPostgresTelegramInbox(pool, { maxAttempts = 8, leaseSeconds = 300 } = {}) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("A PostgreSQL-compatible query client is required");
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) throw new TypeError("maxAttempts must be a positive integer");
  if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 30) throw new TypeError("leaseSeconds must be at least 30");

  return Object.freeze({
    async claim({ provider, eventId, payload }) {
      const result = await pool.query(
        `INSERT INTO telegram_event_inbox
           (provider, event_id, payload, status, attempt_count, locked_at, next_attempt_at)
         VALUES ($1, $2, $3::jsonb, 'PROCESSING', 1, now(), now())
         ON CONFLICT (provider, event_id) DO UPDATE
           SET status = 'PROCESSING',
               attempt_count = telegram_event_inbox.attempt_count + 1,
               locked_at = now(),
               updated_at = now()
         WHERE
           (telegram_event_inbox.status = 'FAILED' AND telegram_event_inbox.next_attempt_at <= now()
             AND telegram_event_inbox.attempt_count < $4)
           OR
           (telegram_event_inbox.status = 'PROCESSING'
             AND telegram_event_inbox.locked_at < now() - ($5::int * interval '1 second')
             AND telegram_event_inbox.attempt_count < $4)
         RETURNING event_id`,
        [provider, eventId, JSON.stringify(payload), maxAttempts, leaseSeconds]
      );
      return result.rowCount === 1;
    },

    async complete({ provider, eventId }) {
      const result = await pool.query(
        `UPDATE telegram_event_inbox
           SET status = 'PROCESSED', processed_at = now(), locked_at = NULL, updated_at = now()
         WHERE provider = $1 AND event_id = $2 AND status = 'PROCESSING'`,
        [provider, eventId]
      );
      if (result.rowCount !== 1) throw new Error("INBOX_COMPLETE_STATE_CONFLICT");
    },

    async fail({ provider, eventId, retryable = true }) {
      const result = await pool.query(
        `UPDATE telegram_event_inbox
           SET status = CASE WHEN NOT $3 OR attempt_count >= $4 THEN 'DEAD_LETTER' ELSE 'FAILED' END,
               locked_at = NULL,
               next_attempt_at = CASE
                 WHEN NOT $3 OR attempt_count >= $4 THEN NULL
                 ELSE now() + (LEAST(3600, power(2, LEAST(attempt_count, 11))::int) * interval '1 second')
               END,
               updated_at = now()
         WHERE provider = $1 AND event_id = $2 AND status = 'PROCESSING'`,
        [provider, eventId, retryable, maxAttempts]
      );
      if (result.rowCount !== 1) throw new Error("INBOX_FAIL_STATE_CONFLICT");
    }
  });
}
