# Workstream 4 — independent evaluation and regression

- Assigned branch: wave2/agent-4-evaluation.
- Branch starting SHA: 8bb81626b0b273761a2fa55b0d253b76e078eb9f (includes the shared frozen-contract commit 1e9df9a728bed86bf9a578f301bcd51635ea2a78).
- Owned paths: packages/kratt-core/test/wave2-evaluation.test.mjs; packages/kratt-orchestrator/test/wave2-evaluation.test.mjs; scripts/chiro-wave2-benchmark.mjs; docs/chiro-x-wave2/testing/**; this manifest.
- Read-only paths: implementation modules and existing workflow definitions; do not edit source owned by another workstream.
- Forbidden paths: shared contracts, global CI/workflows, package manifests/lockfiles, migrations, global authorization policy, main, base, integration branch, and other agent branches.
- Shared contract dependencies: frozen contracts and public runtime/provider/evidence/security interfaces.
- Required APIs: black-box test helpers and deterministic synthetic benchmark for public interfaces.
- Required tests: unit/contract/adversarial/failure simulation for lifecycle, authorization, evidence, providers, privacy, UI state, event ordering, cancellation, persistence errors, and resource bounds.
- Required documentation: TEST-MATRIX.md, TEST-STRATEGY.md, KNOWN-LIMITATIONS.md, benchmark methodology, and measured environment.
- Expected line allocation: 4,000 planning lines; no property-testing dependency unless justified and approved by the coordinator.
- Acceptance: fixed clocks/seeds, no real private images, no arbitrary payload execution, no false pass claims, and every critical requirement mapped to a test or limitation.
- Completion evidence: branch/base SHA, commit, exact commands/results, counts of passed/failed/skipped tests, and measured benchmark output.
