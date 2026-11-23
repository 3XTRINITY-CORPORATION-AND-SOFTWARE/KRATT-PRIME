# Workstream 2 — AURA multimodal runtime

- Assigned branch: wave2/agent-2-aura.
- Starting SHA: fill with the actual frozen-contract integration SHA before implementation.
- Owned paths: packages/kratt-orchestrator/src/aura-multimodal-runtime.mjs; packages/kratt-orchestrator/test/aura-multimodal-runtime.test.mjs; docs/chiro-x-wave2/providers/**; this manifest.
- Read-only paths: frozen contracts, chiro-phase11-pipeline.mjs, PIP validators, policy/authorization modules, existing provider connectors, and all other workstream-owned paths.
- Forbidden paths: shared contracts, AgentRegistry, global policy, package manifests/lockfiles, CI/workflows, migrations, main, base, integration branch, and other agent branches.
- Shared contract dependencies: use Agent 1's ProviderAdapter, ModelCapability, PrivacyPolicy, ConsentRecord, AgentBudget, AgentCancellation, and error contracts.
- Required APIs: provider adapter normalization, capability registry, disabled-by-default external routing, local/mock transport, format/size filtering, structured output validation, redaction, timeout and cancellation mapping.
- Required tests: disabled default, local/remote privacy routing, consent, unsupported capability, malformed/refusal/oversized output, rate limit, timeout, cancellation, fallback restrictions, and redaction. No test reads real credentials.
- Required documentation: provider capability inventory, routing rules, errors, and explicit statement that no live provider is configured.
- Expected line allocation: 4,500 planning lines; do not add provider SDKs without coordinator approval and a written ADR.
- Acceptance: no external access occurs without explicit configuration, policy, consent, capability, and budget; fallback cannot weaken privacy.
- Completion evidence: branch/base SHA, commit, exact tests, mock-vs-live distinction, and known limitations.
