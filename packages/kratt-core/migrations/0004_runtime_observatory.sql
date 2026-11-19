-- KRATT PRIME Phase 10: append-only runtime observability event history and safe operation projection.
BEGIN;

CREATE TABLE IF NOT EXISTS kratt_runtime_observatory_head (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
  sequence BIGINT NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  hash CHAR(64) NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$')
);
INSERT INTO kratt_runtime_observatory_head(singleton, sequence, hash)
VALUES (TRUE, 0, repeat('0', 64))
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS kratt_runtime_operation_events (
  sequence BIGINT PRIMARY KEY CHECK (sequence > 0),
  event_id TEXT NOT NULL UNIQUE,
  operation_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'operation.queued','operation.running','operation.succeeded',
    'operation.failed','operation.cancelled','operation.timed_out','operation.not_run'
  )),
  occurred_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  previous_hash CHAR(64) NOT NULL CHECK (previous_hash ~ '^[a-f0-9]{64}$'),
  hash CHAR(64) NOT NULL UNIQUE CHECK (hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS kratt_runtime_operation_events_operation_idx
  ON kratt_runtime_operation_events(operation_id, sequence DESC);

CREATE TABLE IF NOT EXISTS kratt_runtime_operations (
  operation_id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  adapter_id TEXT,
  capability TEXT NOT NULL,
  capability_state TEXT NOT NULL CHECK (capability_state IN ('bound','partial','mock','unbound','disabled')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled','timed_out','not_run')),
  queued_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms BIGINT CHECK (duration_ms IS NULL OR duration_ms >= 0),
  input_ref TEXT,
  output_ref TEXT,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  environment TEXT NOT NULL CHECK (environment IN ('development','test','staging','production')),
  runtime_version TEXT NOT NULL,
  last_occurred_at TIMESTAMPTZ NOT NULL,
  last_event_id TEXT NOT NULL,
  last_sequence BIGINT NOT NULL REFERENCES kratt_runtime_operation_events(sequence),
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (
    (status = 'queued' AND started_at IS NULL AND finished_at IS NULL AND duration_ms IS NULL)
    OR (status = 'running' AND started_at IS NOT NULL AND finished_at IS NULL AND duration_ms IS NULL)
    OR (status IN ('succeeded','failed','timed_out') AND started_at IS NOT NULL AND finished_at IS NOT NULL AND duration_ms IS NOT NULL)
    OR (status = 'cancelled' AND finished_at IS NOT NULL AND
       ((started_at IS NULL AND duration_ms IS NULL) OR (started_at IS NOT NULL AND duration_ms IS NOT NULL)))
    OR (status = 'not_run' AND started_at IS NULL AND finished_at IS NOT NULL AND duration_ms IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS kratt_runtime_operations_module_updated_idx
  ON kratt_runtime_operations(module_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS kratt_runtime_operations_status_updated_idx
  ON kratt_runtime_operations(status, updated_at DESC);

CREATE OR REPLACE FUNCTION kratt_reject_runtime_operation_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'KRATT_RUNTIME_OPERATION_EVENT_APPEND_ONLY';
END;
$$;
DROP TRIGGER IF EXISTS kratt_runtime_operation_event_no_update ON kratt_runtime_operation_events;
CREATE TRIGGER kratt_runtime_operation_event_no_update
  BEFORE UPDATE ON kratt_runtime_operation_events
  FOR EACH ROW EXECUTE FUNCTION kratt_reject_runtime_operation_event_mutation();
DROP TRIGGER IF EXISTS kratt_runtime_operation_event_no_delete ON kratt_runtime_operation_events;
CREATE TRIGGER kratt_runtime_operation_event_no_delete
  BEFORE DELETE ON kratt_runtime_operation_events
  FOR EACH ROW EXECUTE FUNCTION kratt_reject_runtime_operation_event_mutation();

-- Runtime role: SELECT/INSERT on event history; SELECT/UPDATE on singleton head;
-- SELECT/INSERT/UPDATE on the operation projection. No DDL or DELETE privileges.
COMMIT;
