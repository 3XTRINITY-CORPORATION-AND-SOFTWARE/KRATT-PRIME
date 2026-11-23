# CHIRO-X Wave 2 contracts

Contract package: `packages/kratt-core/src/wave2-contracts.mjs`  
Current version: `1.0.0`  
Status: frozen for dependent workstreams when this file's commit is integrated.

The module exports dependency-free runtime validators. Data validators return `{ ok: true, value }` with a cloned, deeply frozen value, or `{ ok: false, errors }` with stable error codes. They reject unknown fields, accessors, non-finite numbers, non-plain objects, oversized collections, and values outside documented bounds. The provider adapter is an in-process interface with an executable function, so it is shallow-frozen and its capability records are cloned and deeply frozen.

Every serialized contract carries `schema_version: "1.0.0"`. The provider adapter is an in-process object and has no schema-version field. These validators establish shape and basic invariants only. They do not grant authority, verify a source, persist state, or prove a claim.

## Public validators

| Validator | Contract purpose |
|---|---|
| `validateAgentTask` | Bounded task request, DAG dependencies, idempotency key, deadline, budget, and privacy policy |
| `validateAgentCapability` | Versioned agent capability, granted scopes, modalities, locality, and input/output bounds |
| `validateAgentExecutionContext` | Per-attempt identifiers, deadline, cancellation correlation, budget, policy ID, and trace ID |
| `validateAgentExecutionResult` | Terminal attempt result, structured output, evidence references, timestamps, and measured usage |
| `validateAgentError` | Stable error code, retryability, stage, task correlation, and bounded retry hint |
| `validateAgentCancellation` | Cancellation request and acknowledgement state |
| `validateAgentBudget` | Attempt, time, byte, token, and micro-USD ceilings |
| `validateAgentPolicy` | Allowlisted capabilities/providers/modalities, external access, concurrency, and review requirement |
| `validateEvidenceObject` / `validateEvidenceReference` | Evidence claim and typed link without asserting truth |
| `validateProvenanceRecord` | Origin, revision, capture method/time, digest, and independence declaration |
| `validateContradiction` | Conflicting evidence identifiers and review/resolution state |
| `validateInterpretation` | Source claim, hypothesis, or summary with producer, evidence, and review state |
| `validateVerificationResult` | Independent verifier, decision, evidence IDs, and time |
| `validateAuditEvent` | Payload-minimal Wave 2 event envelope |
| `validateRuntimeStatus` | Bounded health and queue summary |
| `validateModelCapability` / `validateProviderAdapter` | Provider/model capabilities and in-process execution adapter |
| `validatePrivacyPolicy` / `validateConsentRecord` | Processing mode, retention/training flags, and consent record shape |

## Safety semantics

- `LOCAL_ONLY` is the safe privacy default in examples. `REMOTE_APPROVED` must carry a consent record ID; a separate authorization adapter must verify consent is current and purpose-bound before dispatch.
- `AgentPolicy.external_access` defaults to false in examples. A valid contract is not authorization to call a provider.
- A `MODEL_OUTPUT` provenance record cannot declare itself independent. A verification result must name a producer distinct from its verifier and explicitly declare independent verification; the evidence adapter must still verify those identities against authoritative records.
- `HYPOTHESIS` cannot be labeled supported or accepted by these validators. An interpretation never turns into a verified fact merely because its shape is valid.
- Audit events carry IDs, lifecycle type, outcome, and time only. Do not add raw image/audio, prompt, provider response, credential, or arbitrary diagnostic payloads.
- A timeout or cancellation is cooperative. The runtime must fence late provider results and must not claim a remote side effect was cancelled without evidence.
- The contract does not promise durable execution, exactly-once effects, tamper-proof audit, or a mounted HTTP API.

See [schema compatibility](SCHEMA-COMPATIBILITY.md), [event catalog](EVENT-CATALOG.md), [error catalog](ERROR-CATALOG.md), and [example task](examples/task.json).
