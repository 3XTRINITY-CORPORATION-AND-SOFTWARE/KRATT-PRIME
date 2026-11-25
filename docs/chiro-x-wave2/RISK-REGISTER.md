# CHIRO-X Wave 2 risk register

Status is baseline unless updated with a commit and test reference.

| Risk | Severity | Detection | Containment and recovery | Status |
|---|---|---|---|---|
| Root and mirror lockfiles include high-severity Vite 8.2.2 and source-map-js 1.2.1 advisories | High | npm audit --package-lock-only on both package roots | Coordinator refreshes only vulnerable lock entries to patched compatible versions; rerun audit and Node 22 CI | Open at baseline |
| Local host only has Node 24 while repository requires Node 22 | High | node --version and engine check | Do not report local Node 24 as supported; use exact-commit Node 22 CI | Open at baseline |
| No general DAG runtime or persisted DAG/Saga state exists | High | Source and consumer map; restart/failure tests | Implement only guarantees backed by a store; otherwise mark recovery-required and document limits | Open at baseline |
| Existing CHIRO provider injection does not enforce routing policy or cancellation | High | Provider mock that ignores processingMode; hung/late provider response tests | New router denies remote by default and runtime fences late results | Open at baseline |
| PIP source references are identifiers, not verified evidence objects | High | Missing/forged source and self-verification tests | Adapt PIP to existing KRATT evidence verification; never promote model output itself | Open at baseline |
| Protected Wave 2 task/review API is not mounted | High | Same-origin route returns 404/unbound | UI stays read-only and visibly unbound until a protected server route exists | Open at baseline |
| External STEEL/GOLIATH code is outside the current CHIRO base and repo scope | High | Integration governance and source tree | Use existing adapters only; no copied app or external repository write | Controlled boundary |
| Branch protection cannot be read through the connected GitHub integration | Medium | GitHub API returns 403 Resource not accessible by integration | Preserve branches and use PR/CI review; protection state remains unknown | Blocked verification |
| CI pull_request filters omit the intended CHIRO-X base | Medium | Inspect workflow triggers and observe run on PR | Coordinator adds only validation triggers, then verify a run on the new draft PR | Open at baseline |
| AURA visualizer can be mistaken for a KRATT operations console | Medium | Product boundary docs and Control Desk contract test | Extend only programs/web/kratt-control-desk; do not move operations into AURA | Controlled boundary |
| No linter, coverage, or property-test framework is declared | Medium | package scripts and dependency manifest | Use built-in Node test runner and bounded deterministic generation unless a justified dependency decision is approved | Open at baseline |
| Postgres outbox is at-least-once and depends on provider idempotency | Medium | Lease/replay contract tests | Do not promise exactly-once effects; fence stale leases and require idempotency | Existing documented limit |
| In-memory MemoryLedger is mistaken for durable evidence | Medium | Store adapter review and restart test | Keep it test/local; use existing durable adapters only where their contract fits | Existing documented limit |
| UI can display stale, reordered, or duplicate events | Medium | Event sequence/correlation UI tests | Ignore duplicates, flag stale sequence, recover by bounded protected read | Not implemented for Wave 2 |
| CI branch creation might trigger automation | Low | Workflow inventory | Inspected workflows run validation/build only; deployment remains prohibited | No deploy workflow found |
