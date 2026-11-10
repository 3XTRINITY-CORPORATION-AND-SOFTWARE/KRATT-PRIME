# KRATT PRIME internal API contract — v1 foundation

Status: local foundation contract; not an authenticated or production API.

The server binds to loopback by default and rejects non-loopback `HOST` values. It exposes no CORS policy, credentials, task queue, provider connector, task execution, or external writes. Do not put this endpoint on a public interface or proxy it publicly.

## Routes

| Method | Path | Purpose | Side effects |
|---|---|---|---|
| `GET`, `HEAD` | `/health/live` (also `/health`) | Process liveness | None |
| `GET`, `HEAD` | `/health/ready` | Static foundation readiness; states execution is disabled | None |
| `GET`, `HEAD` | `/v1/status` | Version and bounded capability summary | None |
| `GET`, `HEAD` | `/v1/audit/status` | Audit adapter availability and chain-integrity summary; no event data | None |
| `POST` | `/v1/tasks/validate` | Validate a JSON KRATT task envelope only | None; never admission or execution |

All responses are JSON with `Cache-Control: no-store`. Unknown routes return `NOT_FOUND`; unsupported methods return `METHOD_NOT_ALLOWED`. Request bodies are limited to 32 KiB and must use `application/json`. Errors do not return exception details or request content.

## Task validation response

Valid envelope: `200` with `valid: true`, `admitted: false`, and `executionStarted: false`.

Invalid envelope: `400` with validator error codes. Malformed JSON is rejected. Validation does not authenticate a principal, load trusted context, authorize, admit, persist, enqueue, or execute the task. This endpoint is a schema-checking contract only.

## Trusted configuration

`HOST`, `PORT`, and `NODE_ENV` are the only consumed settings. Defaults are `127.0.0.1:3000` and `development`. `HOST` must be a loopback address (`localhost`, `::1`, or IPv4 `127.0.0.0/8`); public binding is intentionally not supported. The loader reads the process environment only; it does not parse `.env` files and accepts no secrets.

## Audit contract

The composition root may inject a read-only object implementing `verify()` and optionally a non-negative integer `size`. The endpoint returns only availability, integrity state and head sequence. The current evidence ledger is an in-memory local-simulation adapter, not durable, signed or production audit storage. With no valid adapter the endpoint returns `503 AUDIT_UNAVAILABLE`.

## Deferred before any real internal API

Authentication and principal resolution; trusted context/policy composition; rate limiting; durable audit storage; request-id and idempotency policy; task admission/queue lifecycle; authorization, cancellation and kill-switch enforcement; observability and deployment review. Never interpret a successful schema validation as an execution grant.
