# Workstream 1 — KRATT runtime and shared contracts

- Assigned branch: wave2/agent-1-runtime.
- Branch creation SHA: c9bc202084a2353ae7054ec333edaf09f1affed2.
- Implementation base after contract freeze: 8bb81626b0b273761a2fa55b0d253b76e078eb9f.
- Frozen-contract commit: 1e9df9a728bed86bf9a578f301bcd51635ea2a78; Node 22 CI passed on this commit and its docs-only follow-up.
- Owned paths: packages/kratt-core/src/wave2-contracts.mjs; packages/kratt-core/src/agent-registry.mjs; packages/kratt-core/src/wave2-runtime.mjs; packages/kratt-core/test/wave2-contracts.test.mjs; packages/kratt-core/test/wave2-runtime.test.mjs; docs/chiro-x-wave2/contracts/**; this manifest.
- Read-only paths: existing contracts.mjs, policy.mjs, trusted-runtime.mjs, phase11 files, CHIRO/PIP files, saga.mjs, outbox files, observability files, and all other workstream-owned paths.
- Forbidden paths: package manifests/lockfiles, global CI/workflows, migrations, global authorization policy, main, CHIRO-X base, integration branch, and all other agent branches.
- Shared contract dependencies: no competing schema library; reuse KRATT identifiers, UTC conventions, PIP, existing error patterns, and the published Wave 10 event approach.
- Required APIs: runtime validators for AgentTask, AgentCapability, AgentExecutionContext/Result, AgentError, AgentCancellation, AgentBudget, AgentPolicy, EvidenceObject/Reference, ProvenanceRecord, Contradiction, Interpretation, VerificationResult, AuditEvent, RuntimeStatus, ProviderAdapter, ModelCapability, PrivacyPolicy, and ConsentRecord; deterministic scheduler and runtime APIs after contract freeze.
- Required tests: schemas, compatibility, state transitions, DAG/cycle detection, deterministic ordering, duplicate tasks, capability rejection, budgets, timeout, cancellation, late result fencing, retry/idempotency, and recovery boundary.
- Required documentation: CONTRACTS.md, SCHEMA-COMPATIBILITY.md, EVENT-CATALOG.md, ERROR-CATALOG.md, examples, and this manifest.
- Expected line allocation: 4,500 planning lines; deliver only meaningful code.
- Acceptance: tests pass before dependent branches start; every transition is validated/event-backed; unauthorized work never executes; unsupported durability is explicitly reported.
- Completion evidence: branch and base SHA, commit SHA, exact commands/results, tests, and unresolved limitations.
