# Workstream 6 — authorization and observability

- Assigned branch: wave2/agent-6-security.
- Branch starting SHA: 8bb81626b0b273761a2fa55b0d253b76e078eb9f (includes the shared frozen-contract commit 1e9df9a728bed86bf9a578f301bcd51635ea2a78).
- Owned paths: packages/kratt-core/src/wave2-security-adapter.mjs; packages/kratt-core/test/wave2-security-adapter.test.mjs; docs/chiro-x-wave2/security/**; this manifest.
- Read-only paths: frozen contracts, policy.mjs, trusted-runtime.mjs, async-trusted-runtime.mjs, authorized-dispatch.mjs, audit/outbox stores, Wave 10 observability modules, and all other workstream-owned paths.
- Forbidden paths: global policy or authorization implementation, shared contracts, shared migrations, lockfiles, global CI/workflows, main, base, integration branch, and other agent branches.
- Shared contract dependencies: AgentCapability, AgentPolicy, ConsentRecord, AgentCancellation, AuditEvent, RuntimeStatus, and frozen error/event catalogs.
- Required APIs: a narrow adapter that combines AgentRegistry capability decisions with the existing KRATT authorization runtime and normalizes privacy-safe Wave 10 events.
- Required tests: missing/expired/wrong-bound approval, capability mismatch/revocation, replay, policy conflict, cancellation after approval, external-write disabled, audit sink failure, secret/payload redaction, and fail-closed behavior.
- Required documentation: authority source, event mappings, health/readiness distinctions, audit durability limits, and no tamper-proof claim beyond the store's actual verification.
- Expected line allocation: 3,500 planning lines; never create a competing policy or approval system.
- Acceptance: provider/model output cannot grant authority; protected operations require existing trusted KRATT verification; audit errors block required actions.
- Completion evidence: branch/base SHA, commit, exact tests, dependency on existing storage/runtime contracts, and limitations.
