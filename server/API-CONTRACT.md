# KRATT PRIME internal API contract — v1 foundation

Status: local, loopback-only foundation contract. This is not an authenticated or production API.

The server is composed from five in-process modules. Its status representation is a bounded 5×5 matrix (five module rows by five fixed fields); no worker processes are started. In-memory status and audit state is lost on restart.

## Routes

| Method | Path | Purpose | Effect |
|---|---|---|---|
| `GET`, `HEAD` | `/health/live` (`/health`) | Process liveness | Read-only |
| `GET`, `HEAD` | `/health/ready` | Static readiness and execution-disabled flag | Read-only |
| `GET`, `HEAD` | `/v1/status` | Version, capabilities and five-row module status matrix | Read-only |
| `GET`, `HEAD` | `/v1/audit/status` | Audit availability, in-memory chain integrity and head sequence | Read-only |
| `POST` | `/v1/tasks/validate` | Validate a canonical KRATT task envelope | No persistence, admission or execution |
| `POST` | `/v1/tasks/intake` | Validate, ask the server-owned policy gate, append a minimal audit event | No admission or execution |

Responses are JSON with `Cache-Control: no-store`; request bodies are limited to 32 KiB and require `application/json`. Errors contain stable codes only. No CORS, credential, provider, queue or task executor is configured.

## Five-by-five status matrix

`GET /v1/status` returns exactly five module rows. Each row has five fields: `moduleId`, `state`, `updatedAt`, `capabilities`, and `executionEnabled`. The capability labels are fixed by the server, not request data. Status registry writes exist only as an in-process composition interface and are not exposed as an HTTP mutation route.

## Intake contract

`POST /v1/tasks/intake` accepts exactly one `kratt-prime/v0.1` task envelope. Client-supplied authority, policy results, identities, or execution instructions are not trusted. The validated task is sent to a server-injected policy evaluator; there is no HTTP field for trusted context or policy override.

Response always explicitly states `admitted: false` and `executionStarted: false`. If policy runtime is absent or invalid, response is fail-closed (`503`, `BLOCKED`). A policy `ALLOW` is an advisory result only; it is not an admission or execution grant. A minimal event is appended before a response; if audit append fails, intake returns `503` and remains not admitted. No task is enqueued or retained by this API.

Example response shape:

```json
{
  "ok": false,
  "apiVersion": "v1",
  "taskId": "inventory-17",
  "valid": true,
  "policy": {
    "decision": "BLOCKED",
    "reason": "POLICY_RUNTIME_NOT_CONFIGURED",
    "executionStarted": false
  },
  "admitted": false,
  "executionStarted": false
}
```

## Module interfaces

- `createInMemoryStatusRegistry()` — fixed module catalogue, validated state transitions, immutable 5×5 snapshots.
- `createInMemoryAuditAdapter()` — append-only mock backed by KRATT's hash-chained `EvidenceLedger`; exposes append decision, verify, and size only.
- `createPolicyGate({ evaluator })` — server-owned evaluator seam; fail-closed when absent, exceptions or malformed results; never executes.
- `createServerApp({ statusRegistry, auditAdapter, policyGate })` — HTTP composition seam; task schema validation uses KRATT core validator.

These mocks are for local development and tests. The evidence ledger is in-memory, unsigned and non-durable; its hash chain is not a production audit guarantee.

## Trusted configuration and deployment boundary

Only `HOST`, `PORT`, and `NODE_ENV` are consumed. Default bind is `127.0.0.1:3000`; non-loopback hosts are rejected. No `.env` parser or secrets are part of this package. Do not expose directly or through a public proxy.

Before any real API: authentication/principal resolution, reviewed policy runtime and trusted-context loader, durable transactional audit, rate limiting, idempotency/replay semantics, cancellation and kill-switch enforcement, operational monitoring, backup/restore and security review must be separately implemented and tested. Task execution and external writes remain disabled.
