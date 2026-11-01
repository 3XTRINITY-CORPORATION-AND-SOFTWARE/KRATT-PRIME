# KRATT PRIME — Integration Governance

Status: DESIGN BASELINE / NOT PRODUCTION ENABLED

## Governing boundary

KRATT PRIME is the only repository in scope for implementation changes. AURA, STEEL, FRAME.9, GOLIATH OS and external services remain read-only sources unless a separately approved change explicitly says otherwise. The `main` branch is not a development target. External write actions, production deployment, credential changes and account-permission changes are denied by default.

## Integration lifecycle

Each integration must be represented as a typed record with:
- stable integration ID and provider name;
- provider/account identity (never a secret);
- capability set split into read and write scopes;
- allowed resource/target scope;
- connection verification timestamp and evidence reference;
- credential reference identifier only (never credential contents);
- lifecycle state: `DISCOVERED`, `CONNECTED_UNVERIFIED`, `VERIFIED_READ_ONLY`, `WRITE_PENDING_APPROVAL`, `WRITE_ENABLED`, `DISABLED`, `ERROR`;
- last successful verification and last error code.

A connector being present in the tool catalogue is not proof that the user's account is connected or that a requested scope is granted.

## Authorization invariants

1. The authorization plane is deterministic and outside model-generated plans.
2. Missing, malformed, stale or contradictory trusted context returns deny.
3. Request-supplied authority claims never grant authority.
4. Effective scope is the intersection of principal, agent, connector, resource and task scopes.
5. Read scopes never imply write scopes.
6. Every external write requires a request-bound approval artifact naming provider, operation, target and expiry.
7. Approval for one operation cannot authorize a different target, operation, provider or later request.
8. Secrets are resolved only by the server-side credential broker and are never included in records, logs, prompts or client payloads.
9. Every allow/deny decision emits a redacted provenance event.
10. Kill switch and integration disablement override all grants.

## Adapter contract

Adapters expose typed operations, not arbitrary URL fetches or free-form tool execution. Every operation declares:
- operation ID and schema version;
- required scopes;
- target constraints;
- idempotency behavior;
- timeout and budget;
- side-effect classification;
- evidence output schema;
- cancellation and recovery semantics.

Default side-effect class is `EXTERNAL_WRITE`, therefore denied absent exact approval.

## Evidence states

- `OBSERVED`: obtained from a live connector response.
- `INFERRED`: reasoned from other evidence; not direct verification.
- `CONFIGURED`: a workflow or setting exists but has not necessarily run.
- `EXECUTED`: operation ran and returned a result.
- `VERIFIED`: result independently checked against acceptance criteria.
- `BLOCKED`: attempted verification was unavailable or denied.

## Current connector inventory (2026-11-01)

| Provider | Observed state | Scope / limitation |
|---|---|---|
| GitHub | Connected | KRATT-PRIME repository; branch-scoped development only |
| Asana | Connected | Read-only project/task audit performed |
| TinyFish | Tool available | Search/fetch tools available; no Agent API credential or run integration verified |
| Base44 | Connected | KRATT Integration Hub app listed; no source write performed |
| WPVibe | Account connected, no sites registered | No WordPress site connection to audit |
| Consensus | Search tool available | Research only; not an execution adapter |
| Parallel Search | Search/fetch tool available | Research only |
| Exa | Search/fetch tool available | Research only |
| Higgsfield | Account identity verified | No KRATT runtime adapter implemented or exercised |

This inventory describes connector observations, not production readiness.

## Acceptance tests required before write enablement

- no trusted context => DENY;
- connector absent/unverified => DENY;
- read-only capability asked to write => DENY;
- agent scope broader than principal scope => DENY;
- wrong provider, target, operation or expired approval => DENY;
- revoked approval or active kill switch => DENY;
- valid request-bound approval => permit only the exact operation;
- secrets never appear in audit payloads;
- each execution and decision references a source revision and evidence digest.

## Deferred implementation

This document does not claim durable storage, signed approvals, an external credential broker, live provider adapters, production policy enforcement or completed red-team verification. These require separate code, tests and connector-level acceptance evidence.
