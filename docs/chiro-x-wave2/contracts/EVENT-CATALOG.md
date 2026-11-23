# Wave 2 event catalog

Event names are stable identifiers. `validateAuditEvent` requires an exact payload-minimal envelope: `schema_version`, `event_id`, `event_type`, `occurred_at`, `actor_id`, `subject_id`, `correlation_id`, nullable `task_id`, and `outcome`. The contract intentionally has no arbitrary payload/details field.

| Event | Meaning |
|---|---|
| `agent.task.accepted` | Admission passed structural checks; not proof of authorization or execution |
| `agent.task.blocked` | A task cannot proceed until a named prerequisite or authority is available |
| `agent.task.started` | A specific attempt began |
| `agent.task.retry_scheduled` | A bounded retry was scheduled under the original deadline and budget |
| `agent.task.completed` | An attempt produced a validated terminal result |
| `agent.task.failed` | An attempt ended in failure |
| `agent.task.cancelled` | Runtime acknowledged cancellation and fenced any late result |
| `agent.task.timed_out` | The deadline elapsed; external side-effect state may still require reconciliation |
| `agent.evidence.recorded` | An evidence reference was recorded, not promoted to truth |
| `agent.contradiction.detected` | Conflicting evidence was identified for review |
| `agent.interpretation.proposed` | A claim/hypothesis/summary was proposed |
| `agent.verification.completed` | An independent verification decision was recorded |
| `agent.runtime.status_changed` | Runtime health or readiness changed |

Use a unique event ID and stable correlation ID. Consumers deduplicate by event ID and treat stale/reordered events conservatively. Do not serialize raw user content, media, tokens, provider responses, or arbitrary errors into events. Event persistence and ordering are responsibilities of the selected store/observability adapter, not this schema module.
