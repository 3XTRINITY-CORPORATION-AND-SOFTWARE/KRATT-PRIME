# Wave 2 error catalog

`validateAgentError` accepts only a code in this catalog and a bounded message, stage, correlation ID, retryable flag, nullable task ID, and nullable bounded retry hint. Do not put secrets, user payload, or provider response text in `message`.

| Code | Meaning | Retry guidance |
|---|---|---|
| `W2_CONTRACT_INVALID` | Shape, field, or bound validation failed | No retry without correcting the request |
| `W2_VERSION_UNSUPPORTED` | Contract version is not supported | Coordinate version upgrade |
| `W2_TASK_DUPLICATE` | Task or idempotency key already exists | Return the existing task or a conflict |
| `W2_TASK_NOT_FOUND` | Referenced task is absent | No automatic retry |
| `W2_DEPENDENCY_INVALID` | Dependency is absent or malformed | Correct the DAG |
| `W2_DEPENDENCY_CYCLE` | DAG contains a cycle | Correct the DAG |
| `W2_CAPABILITY_DENIED` | No active agent has the requested capability | No automatic privilege escalation |
| `W2_POLICY_DENIED` | Existing KRATT policy denied the action | No retry unless policy/approval changes |
| `W2_CONSENT_REQUIRED` | Valid current purpose-bound consent is absent | Require user consent |
| `W2_PROVIDER_DISABLED` | Provider routing is disabled | Do not fall back to remote routing |
| `W2_PROVIDER_UNAVAILABLE` | Provider transport is unavailable | Bounded retry only if policy allows |
| `W2_PROVIDER_TIMEOUT` | Provider deadline elapsed | Reconcile possible remote effects before retry |
| `W2_BUDGET_EXCEEDED` | Time, attempts, bytes, tokens, or cost ceiling reached | No automatic retry |
| `W2_CANCELLED` | Cancellation was acknowledged | Terminal for that attempt |
| `W2_DEADLINE_EXCEEDED` | Task deadline elapsed | Requires explicit re-admission for new deadline |
| `W2_EVIDENCE_INVALID` | Evidence/provenance failed validation | Preserve original claim; no auto-promotion |
| `W2_VERIFICATION_UNAVAILABLE` | Independent verifier could not establish result | Keep claim unverified |
| `W2_AUDIT_UNAVAILABLE` | Required audit sink failed | Fail closed for protected operations |
| `W2_STATE_CONFLICT` | Concurrent transition or stale version conflict | Reload authoritative state before retry |
| `W2_STORAGE_UNAVAILABLE` | Required state store unavailable | Backpressure; do not claim durable acceptance |

An error's `retryable` value is advisory to orchestration. Runtime policy, idempotency, remaining budget, deadline, and side-effect reconciliation determine whether another attempt is allowed.
