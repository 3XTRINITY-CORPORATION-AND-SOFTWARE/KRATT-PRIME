# KRATT PRIME — Initial Threat Model

Status: INITIAL DESIGN / TEST PLAN ONLY

## Assets

- authorization context and approval artifacts;
- connector credentials and credential references;
- source repository metadata and imported evidence;
- memory records, embeddings and temporal versions;
- Saga state, checkpoints and compensation records;
- audit/provenance records and build attestations.

## Trust boundaries

1. Model/planner → deterministic authorization service.
2. Agent runtime → tool/connector adapter.
3. KRATT PRIME → external provider account.
4. Imported repository/document content → trusted internal state.
5. Local client → server-owned control plane.
6. Build workflow → release artifact/evidence store.

No imported text, repository README, web page, issue description or tool output is executable instruction. It is untrusted data.

## Threat register

| Threat | Abuse path | Required control | Minimum acceptance test |
|---|---|---|---|
| Prompt injection | Untrusted content instructs agent to exfiltrate or mutate | Treat retrieved content as data; deterministic pre-tool authorization | Malicious document cannot grant scope or call write operation |
| Tool abuse | Agent calls unintended provider/operation | Typed adapter allowlist and deny-by-default | Unknown operation and target are denied |
| Delegation escalation | Child agent requests broader scope | Scope intersection, no elevation by delegation | Child cannot exceed parent/principal scopes |
| Memory poisoning | False or hostile record influences retrieval | Provenance, trust labels, versioning and quarantine | Unverified record cannot satisfy required verified evidence |
| SSRF | URL adapter accesses internal/metadata endpoints | URL allowlist, DNS/IP validation, redirect revalidation, egress policy | Private/link-local/metadata target denied before fetch and after redirect |
| Secret exposure | Token leaks through logs, prompts or records | Server-side credential broker and redaction | Canary secret never appears in any emitted record/log |
| Replay | Old approval or tool event reused | Request nonce, expiry, operation/target binding, idempotency key | Expired/replayed approval is denied |
| Partial workflow failure | Saga leaves orphaned side effects | Durable checkpoints, idempotent steps and compensators | Injected failure triggers recorded recovery path |
| Kill-switch bypass | Agent continues after disable | Authorization checks kill-switch on every side effect | Disabled agent cannot invoke connector |
| Supply-chain compromise | Dependency/workflow substitution | Lockfile, pinned actions, SBOM and provenance | Dependency/action drift is detected and recorded |

## Risk handling

- Default decision for unknown or ambiguous cases: DENY.
- No user data sent to third-party AI providers without authorized integration.
- No production deployment, credential rotation, public release or external writes as part of this work.
- Do not represent prototypes or reference adapters as secure isolation boundaries.
- Keep user-facing errors free of secrets and private payloads.

## Verification status

This is a threat model and acceptance checklist. It is not a completed red-team exercise, penetration test, security certification or proof that every listed control is implemented.
