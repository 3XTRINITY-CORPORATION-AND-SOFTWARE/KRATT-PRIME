# CHIRO-X Wave 2 repository baseline

Status: inspected 2026-11-23; facts below describe the verified checkout at the recorded SHAs.

## Repository and branch state

- Canonical repository: antonioportfelli-boop/KRATT-PRIME, public fork; GitHub owner identity and active login both resolve to antonioportfelli-boop.
- Repository API reports admin, maintain, pull, and push permission for that identity. Creating the authorized Wave 2 branch through the connected GitHub account succeeded.
- Development scope is the CHIRO-X branch, never main.
- main starting SHA: 0cf8b034e6f3ec12818d8b5b51ca2cdf12ba07c6.
- CHIRO-X starting branch: feature/chiro-x-pattern-intelligence-v1.
- CHIRO-X starting SHA: 15df6507a5bbff92a4f5b41e3f4daf0258d2cb9f.
- PR #47: open, draft, mergeable according to GitHub metadata, head feature/chiro-x-pattern-intelligence-v1 at 15df6507a5bbff92a4f5b41e3f4daf0258d2cb9f. Its base is feature/phase11-wave10-reconciled-2026-11-23 at 601dcfe723d9fb517674d798a8c6061f2a8c162a. PR #47 is preserved and must not be merged.
- Existing Wave 2 integration branch and all six wave2/agent-* branches were absent during preflight. feature/chiro-x-wave2-intelligence-fabric was created from the verified CHIRO-X head; its initial SHA is 15df6507a5bbff92a4f5b41e3f4daf0258d2cb9f.
- The clone was clean before work began. No tags or pre-existing worktrees were found. The coordinator created one detached audit worktree at the CHIRO-X SHA; it contains no user changes.
- GitHub branch-protection read returned 403 Resource not accessible by integration. Protection rules are therefore UNKNOWN, not absent.

## Toolchain and repository scripts

- The canonical root package uses npm with package-lock version 3. CI uses Node 22. The root .nvmrc is 22 and package.json requires Node >=22 <23.
- The host Node is 24.21.0 with npm 11.19.0; Node 22 is not installed locally. No local node_modules directory exists. Local Node 24 results must not be represented as supported Node 22 validation.
- Root npm test runs node --test over packages/kratt-core/test/*.test.mjs and packages/kratt-orchestrator/test/*.test.mjs. npm run typecheck runs TypeScript. npm run build runs typecheck followed by Vite.
- No lint or formatter script is declared.
- The repository also has trinitywayve-aura/package.json and a second package-lock. Both lockfiles are byte-identical; the nested package manifest omits root test/runtime scripts. Repository documentation identifies the root app as canonical and the nested tree as a mirror.
- The lockfile identifies fsevents as an optional package with an install hook. No install was run locally. CI already completed npm ci successfully on the baseline SHA.

## Verified baseline validation

- GitHub Actions CI run #519, run ID 45246468676, completed successfully on the exact CHIRO-X SHA in a pull_request event. The workflow runs Node 22, npm ci, npm test, npm run typecheck, and npm run build.
- CI run #518, run ID 45246456422, completed successfully on the same SHA from a push event.
- KRATT PRIME CI run #297, run ID 45246456383, completed successfully on the same SHA.
- The above are remote baseline results. A local Node 22 baseline was NOT EXECUTED because the supported runtime is unavailable on the host.
- The repository has no dedicated dependency-security job in the inspected workflows.

## Dependency audit

Command: npm audit --package-lock-only --json, run at the root and in the nested mirror on 2026-11-23. Both lockfiles report two high-severity vulnerable packages: vite 8.2.2 and source-map-js 1.2.1. npm reports fixes available. The published patched versions verified from the GitHub Advisory Database are vite 8.2.4 and source-map-js 1.2.2. The root and mirror lockfiles are identical, so the coordinator owns the targeted lockfile refresh and its ADR. No broad upgrade or new dependency is authorized.

- source-map-js advisory: https://github.com/advisories/GHSA-68fv-2mgg-jv7q
- Vite advisory: https://github.com/advisories/GHSA-9jrq-w75r-8gcw
- Vite Windows launch-editor advisory: https://github.com/advisories/GHSA-698v-4r3x-3vcv

## Current workflow behavior

- The inspected CI workflows run tests, typecheck, and builds; no deployment or release job is present in the CHIRO-X base workflows.
- ci.yml does not include the new Wave 2 push branch and its pull_request base filter does not include feature/chiro-x-pattern-intelligence-v1.
- kratt-core-tests.yml runs on feature/** pushes but its pull_request base filter also omits feature/chiro-x-pattern-intelligence-v1.
- The coordinator must update only the necessary validation triggers after reviewing all workflow effects. This is not permission to deploy or publish.

## Existing implementation baseline

- The existing PR adds 1,264 lines across seven files: strict PIP contracts, CHIRO-X definitions/evaluation, a Phase 11 provider-injection adapter, documentation, and regression tests.
- PIP validates metadata-only observations, privacy flags, interpretations, event envelopes, references, and schema version. The Phase 11 adapter calls injected vision and interpretation providers and an injected trusted verifier.
- CHIRO provider calls currently have no general cancellation, timeout, retry budget, or durable task record. Provider routing is injected and not enforced by a provider capability registry.
- AgentRegistry currently provides registration and scope checks. CHIRO agent definitions are registered in tests/composition code, but the pipeline does not schedule registry agents.
- Saga is a pure in-memory transition helper. It validates transitions and event IDs but does not persist, schedule, recover, or fence external work.
- Phase 11 composes the phase-upgrade engine through the Wave 10 observed-operation facade. It is not a general DAG scheduler.
- Reusable authorization, storage, evidence, and observability modules are mapped in DEPENDENCY-MAP.md. No generic agent DAG runtime or general PIP evidence adapter was found.
- programs/web/kratt-control-desk is an existing read-only control-plane UI. It reads same-origin Observatory GET endpoints. No Wave 2 task, evidence, or review endpoint is mounted.

## Baseline evidence locations

- PR #47: https://github.com/antonioportfelli-boop/KRATT-PRIME/pull/47
- CI run #519: https://github.com/antonioportfelli-boop/KRATT-PRIME/actions/runs/45246468676
- CI run #518: https://github.com/antonioportfelli-boop/KRATT-PRIME/actions/runs/45246456422
- KRATT PRIME CI run #297: https://github.com/antonioportfelli-boop/KRATT-PRIME/actions/runs/45246456383
