# CHIRO-X Wave 2 build plan

## Workstreams and dependency order

| Order | Branch and owner | Scope | Depends on | Acceptance |
|---|---|---|---|---|
| 0 | Coordinator on feature/chiro-x-wave2-intelligence-fabric | Baseline, failure model, ownership manifests, narrow dependency remediation, CI trigger repair, integration | Verified CHIRO-X head | Exact starting SHA recorded; PR #47 preserved; main untouched |
| 1 | wave2/agent-1-runtime | Shared Wave 2 contracts first, then deterministic DAG/runtime and AgentRegistry extension | Baseline commit | Contract tests pass before other agents start; runtime rejects cycles, unauthorized work, duplicates, late completions, and invalid budgets |
| 2 | wave2/agent-2-aura | Provider-neutral multimodal adapter and privacy-first router | Frozen contracts | External access disabled by default; local mocks cover provider failure, schema, cancellation, timeout, and privacy routing |
| 2 | wave2/agent-3-evidence | PIP-to-KRATT evidence adapter using existing evidence reflection and provenance conventions | Frozen contracts | Missing provenance or self-verification cannot produce a supported source claim; contradictions and corrections preserve original provenance |
| 2 | wave2/agent-6-security | Capability/authorization adapter and Wave 10 audit integration | Frozen contracts | Existing KRATT authorization remains the authority; denial, expiry, replay, cancellation, redaction and external-write-disabled tests pass |
| 3 | wave2/agent-4-evaluation | Independent test matrix, adversarial/failure simulations and synthetic benchmarks | Public interfaces from workstreams 1–2 | Tests exercise public APIs, fixed seeds/clocks, and report measured limits without live-provider claims |
| 4 | wave2/agent-5-edge-ui | Extend the existing KRATT Control Desk, not AURA; display task/evidence status only when backed by a protected API | Stable status/evidence contracts | Accessible status semantics, stale/duplicate event handling, privacy display, and honest unbound/degraded states |
| 5 | Coordinator | Cherry-pick/review commits, resolve integration, add CI base triggers, test full branch, draft PR | All agent commits | One Draft PR to feature/chiro-x-pattern-intelligence-v1; no merge, deploy, or release |

The integration coordinator is the only writer to the integration branch. Each agent works in its own worktree and branch. Agent 1 freezes contracts before dependent branches are created. A workstream manifest's starting SHA is filled from the actual branch point before implementation starts.

## Coordinator-owned files

- docs/chiro-x-wave2/BASELINE.md, DEPENDENCY-MAP.md, BUILD-PLAN.md, RISK-REGISTER.md, FAILURE-MODE-ANALYSIS.md, REPOSITORY-BOUNDARIES.md, and the final report.
- .github/workflows/** and package.json/package-lock.json changes.
- Shared migrations, integration cherry-picks, and the integration branch.

Agents must not modify lockfiles, global CI, shared migrations, global authorization policy, or another agent's files. Shared contract changes after freeze require the change-control process in the master directive.

## Checkpoints

1. Baseline: repository, branch, PR, toolchain, dependency, architecture, and boundary evidence recorded.
2. Contract freeze: all canonical contracts have runtime validators, compatibility rules, error/event catalogs, and tests.
3. Core runtime: DAG scheduling is deterministic; state changes are event-backed; authorization, dedupe, cancellation, timeout, retry, budgets, and recovery boundaries are explicit.
4. Parallel services: provider, evidence, and security adapters consume frozen contracts and reuse existing KRATT components.
5. Evaluation: tests cover positive and negative paths, failure injection is deterministic, and synthetic measurements state the environment.
6. UI: the Control Desk reports only verified API data, shows blocked/unbound/degraded states, and keeps external writes unavailable.
7. Integration: no duplicate subsystems, hidden contract changes, circular dependencies, or unreviewed shared files.
8. Validation: exact commit tested on Node 22 CI; dependency audit, privacy checks, security regression, typecheck and build are reported truthfully.
9. Draft PR: target feature/chiro-x-pattern-intelligence-v1; PR #47 stays open and unmerged.

## Scope and measurement

The requested line allocations are planning estimates, not permission to generate filler. Count meaningful source and test lines at the end, and report any smaller implementation with the architectural reason. No live provider, STEEL deployment, GOLIATH deployment, durable DAG recovery, or production behavior may be claimed without direct evidence.
