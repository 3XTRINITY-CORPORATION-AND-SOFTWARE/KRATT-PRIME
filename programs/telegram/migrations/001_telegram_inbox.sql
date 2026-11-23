CREATE TABLE IF NOT EXISTS telegram_event_inbox (
  provider text NOT NULL CHECK (provider = 'telegram'),
  event_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  locked_at timestamptz,
  lease_token text,
  next_attempt_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id),
  CHECK ((status = 'PROCESSED' AND processed_at IS NOT NULL) OR status <> 'PROCESSED')
);

CREATE INDEX IF NOT EXISTS telegram_event_inbox_retry_idx
  ON telegram_event_inbox (next_attempt_at)
  WHERE status = 'FAILED';

CREATE INDEX IF NOT EXISTS telegram_event_inbox_stale_lock_idx
  ON telegram_event_inbox (locked_at)
  WHERE status = 'PROCESSING';

COMMENT ON TABLE telegram_event_inbox IS
  'Durable idempotency inbox for Telegram updates; do not truncate in production.';

ALTER TABLE telegram_event_inbox
  ADD COLUMN IF NOT EXISTS lease_token text;
