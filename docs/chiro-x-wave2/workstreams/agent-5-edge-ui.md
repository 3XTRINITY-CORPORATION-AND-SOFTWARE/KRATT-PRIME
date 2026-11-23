# Workstream 5 — KRATT Control Desk integration

- Assigned branch: wave2/agent-5-edge-ui.
- Branch starting SHA: 8bb81626b0b273761a2fa55b0d253b76e078eb9f (includes the shared frozen-contract commit 1e9df9a728bed86bf9a578f301bcd51635ea2a78).
- Owned paths: programs/web/kratt-control-desk/index.html; app.js; styles.css; README.md; packages/kratt-core/test/chiro-control-desk-contract.test.mjs; docs/chiro-x-wave2/ui/**; this manifest.
- Read-only paths: frozen contracts, runtime/evidence APIs, existing Observatory routes, AURA root application, and all other workstream-owned paths.
- Forbidden paths: root AURA src/**, nested AURA app, STEEL/GOLIATH code, shared contracts, package manifests/lockfiles, workflows, migrations, main, base, integration branch, and other agent branches.
- Shared contract dependencies: frozen task lifecycle, RuntimeStatus, EvidenceReference, Contradiction, VerificationResult, and audit/event identifiers.
- Required APIs: accessible status/event normalization and read-only rendering for task state, provenance, evidence, contradictions, provider state, and human-review status when a protected API provides them.
- Required tests: status mapping, stale/duplicate/out-of-order events, privacy allowlist, keyboard labels, empty/error/unknown states, and responsive/reduced-motion behavior supported by existing tooling.
- Required documentation: exact protected endpoint contract and unbound behavior. Do not invent a server endpoint or imply review actions are available before authorization-backed routes exist.
- Expected line allocation: 3,500 planning lines; the master directive explicitly allows a smaller result when no legitimate UI/API exists.
- Acceptance: no unverified claim is styled as success; no raw private payload, secret, or arbitrary diagnostic is rendered; same-origin protected reads remain authoritative.
- Completion evidence: branch/base SHA, commit, tests, screenshots or browser evidence if available, and UI limitations.
