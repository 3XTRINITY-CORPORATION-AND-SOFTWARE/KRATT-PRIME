# Workstream 3 — PIP evidence and contradictions

- Assigned branch: wave2/agent-3-evidence.
- Branch starting SHA: 8bb81626b0b273761a2fa55b0d253b76e078eb9f (includes the shared frozen-contract commit 1e9df9a728bed86bf9a578f301bcd51635ea2a78).
- Owned paths: packages/kratt-core/src/chiro-evidence-adapter.mjs; packages/kratt-core/test/chiro-evidence-adapter.test.mjs; docs/chiro-x-wave2/evidence/**; this manifest.
- Read-only paths: frozen contracts, pip-contracts.mjs, motlemine-engine.mjs, meridian-truth-chain.mjs, semantic-evidence-bridge.mjs, contracts.mjs, and all other workstream-owned paths.
- Forbidden paths: modifying existing evidence engines without coordinator-assigned ownership, shared contracts, global policy, lockfiles, workflows, migrations, main, base, integration branch, and other agent branches.
- Shared contract dependencies: use EvidenceObject/Reference, ProvenanceRecord, Contradiction, Interpretation, VerificationResult, AuditEvent, and stable error contracts.
- Required APIs: adapt PIP source claims to validated KRATT evidence; preserve independent verification and origin; produce typed contradiction and correction proposals without silently changing source claims.
- Required tests: missing/unavailable/stale sources, invalid provenance, duplicate and derivative source handling, self-verification rejection, source/claim conflicts, cycle handling, correction preservation, and human-review state.
- Required documentation: evidence flow, source verification dimensions, contradiction categories, calibration limits, and no mathematical truth guarantee.
- Expected line allocation: 5,000 planning lines; reuse MÕTLEMINE and Meridian where their schema fits instead of building a competing engine.
- Acceptance: model output cannot verify itself; unsupported claims remain unverified; all correction proposals retain the original interpretation and provenance.
- Completion evidence: branch/base SHA, commit, exact tests, source verification contract, and gaps requiring external integrations.
