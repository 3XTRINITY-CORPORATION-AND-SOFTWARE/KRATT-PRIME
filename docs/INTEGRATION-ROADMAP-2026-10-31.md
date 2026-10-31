# KRATT PRIME — GitLab/GitHub ingestion and governed self-improvement plan
**Audit date:** 2026-10-31  
**Status:** AUDIT / PLAN ONLY — no source migration, merge, deployment or credential changes performed.

## Executive status
- Canonical target identified: `antonioportfelli-boop/KRATT-PRIME`, public, default branch `main`, current HEAD `4bbd4170a90da7ac0934f185586f53c4cfc9bd5d`.
- GitHub connector has admin/push/pull access to KRATT-PRIME, AURA, STEEL and FRAME.9.
- KRATT-PRIME's current main is not yet the planned standalone KRATT engine. Its README and package manifest identify it as AURA (`name: aura`); its root source and `trinitywayve-aura/` tree duplicate AURA scaffolding. The current branch list contains only `main`, which is unprotected. Do not overwrite this baseline.
- GitLab's browser inventory found no standalone KRATT PRIME project. KRATT is currently represented inside `ARHIDEKT/my-side-project`.
- No GitLab API connector is available in this ChatGPT tool session. Browser inspection was read-only. No clone, export, import or remote push was done.
- Lovable project `My Side Project` (id `559f12c2-8eb6-45a6-861b-e8d7ff6a0bf8`) has latest observed SHA `253f09cfee55d06756f96ab02a55856e33fe0205` and includes the richest governance, KRATT schema, TÖEPÄRA, agent network and integration documentation. Its external Git remote identity and exact synced branch are explicitly NOT_VERIFIED in its own bridge state.
- Linear and Asana both contain KRATT PRIME workstreams; Asana's KRATT project currently has 18/18 tasks open. Linear's PRIME project is Planned.

## Repository inventory and intended roles

| Source | Current evidence | Intended PRIME relationship | Migration decision |
|---|---|---|---|
| `ARHIDEKT/my-side-project` (GitLab) | Private, `main`, last activity 2026-10-30, 4 open MRs per browser inspection | Governance/control-plane source; agent workflow, KRATT schema, TÖEPÄRA, platform contracts | First source to reconcile against Lovable. Do not blindly duplicate if it is the Lovable remote. |
| `goliath-os1/steel-3xtrinity-corporation-official-music-software` (GitLab) | Private, `main`, 102 commits, 28 branches, ~36 MiB, AGPLv3, last activity 2026-10-02 | STEEL source | Preserve full history and license; compare with GitHub STEEL before import. |
| `goliath-os-demo2/steel-3xtrinity-corporation-official-music-software` (GitLab) | Private, `main`, 134 commits, AGPLv3, last activity 2026-09-30 | Historical/alternate STEEL runtime source | Compare ancestry, branches and content to first STEEL repo and GitHub STEEL; do not choose arbitrarily. |
| `goliath-os1/goliath-os` (GitLab) | Private, `main`, 11 commits, last activity 2026-09-28 | GOLIATH control-plane integration | Inspect source and reconcile with GOLIATH copies below. |
| `goliath-os-demo2/goliath-os` (GitLab) | Private, `master`, 13 commits, MIT | Historical governance/control-plane variant | Compare history and license; preserve as separate provenance. |
| `3xtrinity/goliath-os` (GitLab) | `master`; visibility inferred private; Node/Express template per browser view | Possible legacy seed | Confirm access, branch history and relevance before import. |
| `3xtrinity/goliath-os-2` (GitLab) | `main`, last activity 2026-05-24 | Possible alternate legacy copy | Compare against other GOLIATH sources. |
| `ARHIDEKT/goliath`, `goliath-os-demo2/goliath` (GitLab) | Private, main; May 2026 activity | Potential archived/supporting sources | Inventory only; no merge until code/license audit. |
| GitHub AURA | Public, 50,454 KB, admin access; README says separate visualizer | AURA client/visualization adapter | Keep separate source of truth. AURA does not become PRIME's core. |
| GitHub STEEL | Public, 36,254 KB, admin access | STEEL product adapter | Keep independent; compare against both GitLab copies. |
| GitHub FRAME.9 | Public, 2,427 KB, admin access | Authenticated security-audit product / integration adapter | Keep independent; connect through typed adapter contracts. |
| GitHub KRATT-PRIME | Public, 50,381 KB, admin access | Canonical standalone orchestration core | Preserve existing main; establish clean integration branch after source map and history backup. |

## Existing implementation: evidence-backed status

### Lovable / My Side Project
Observed files include:
- `.agents/PROTOCOL.md`, `.agents/ROLES.md`, `.agents/network.yaml`, task/handoff/release/recovery templates.
- `.3xtrinity/registry.json` and `.3xtrinity/repo.json`.
- `.gitlab-ci.yml`, `.gitlab/ci/altitude-zero.v1.yml`, MR template.
- Versioned JSON contracts for candidate artifacts, event envelopes and project specs.
- `docs/3xtrinity-control-plane.md`, `docs/3xtrinity-platform-architecture.md`, `docs/THREAT-MODEL.md`, `docs/KRATT-TOEPARA.md`.
- `src/lib/kratt/schema/` runtime validators and pure policy evaluator (`kratt-schema/v1`).
- `src/lib/kratt/core.ts` and `src/lib/kratt/toepara.ts`.
- `src/lib/platform/policy.ts` fail-closed RBAC; `src/lib/platform/adapters.ts` is interface-only and returns adapter-not-implemented.
- `src/lib/platform/wifi-scan.ts` is a pure parser for user-imported Android dumpsys/JSON/CSV; it does not scan networks or expose passwords.
- KRATT 5x UI and tests, plus an Android scaffold and CI workflow.
- Migration files for FRAME.9 and product/service modules.

**Not yet a live executor:** the architecture document states that agent orchestration/task queue is a prototype; no executor currently executes work. GitHub/GitLab/MCP live adapters are planned, not configured. UI beacons must remain demo/not-configured until verified server-side adapters exist.

The project bridge also states that the external repository identity/provider and synced branch are NOT_VERIFIED. Verify the exact GitLab or GitHub commit before assuming Lovable HEAD is already synchronized.

### KRATT / TÖEPÄRA implementation details
- KRATT is the bounded goal/action proposer.
- TÖEPÄRA is the evidence-admission and signal-truth gate.
- Schema engine validators cover task envelope, evidence, trusted context, policy decision, execution receipt and provenance link.
- Policy decisions are default-deny and do not execute work.
- Execution conversion (CB-002) is explicitly deferred; no shell/process/network/file executor is part of the schema package.
- Historical 2026-10-29 evidence recorded 242 tests passing, but full lint failed with 4,263 errors + 15 warnings; production build not run; stale critical security findings were unresolved. These are historical recorded results, not a fresh test run in this audit.
- Wi-Fi import/analysis is marked implemented/tested for imported files only. Native Android Wi-Fi collection remains planned/not built.

### Other confirmed workstreams
- Linear `STE-102`: PRIME bootstrap, Backlog / High; should be reconciled because the GitHub repo now exists but contains AURA scaffolding.
- Linear `STE-65`: KRATT Memory Deep-Tech v1, In Progress / High; GitLab branch `feature/kratt-memory-deep-tech-v1` noted in issue.
- Linear `STE-89`: local evidence-first memory ledger V0 marked Done.
- Linear `STE-88`: 250-node deterministic Rust diagnostic topology marked Done.
- Linear `STE-64`: agent kernel v0.1 In Review / Urgent; GitLab MR !35 references commit `0d66fee0806e5f4249938eac329c10cf63dc6fef`, merge `a5e5c62e35379ef3766bc8695e3657e18b178a71`, pipeline `2905342974` passed with warnings; repository-wide quality baseline was allowed to fail. No production deployment claimed.
- Linear `STE-100`: urgent quality-baseline follow-up remains Todo.
- Asana `KRATT PRIME — Governed AI Control Plane`: 18 tasks; 0 completed.
- Asana `FRAME.9 — Trinity UI & Semantic Engine`: 16 tasks; 0 completed.
- Asana `Android & Native Build Sprint`: 8 tasks; 1 completed.

## Integration and migration rules

### Never flatten the products into one code pile
PRIME is the orchestration/control plane. AURA, STEEL, FRAME.9 and GOLIATH remain separate products with explicit adapters. The initial ingestion should be:
1. Preserve every source repo, branch, tag, commit and license.
2. Capture source project path, default branch, exact HEAD SHA, commit count, tags, branches, LFS, CI, open MR and license manifest.
3. Generate a read-only repository inventory and compare common ancestry/diffs.
4. Decide per source whether it is (a) already represented in GitHub, (b) the same Lovable-connected source, (c) a historical fork, or (d) a distinct source.
5. Mirror full Git history to a dedicated GitHub repository or archival mirror where appropriate. Do not copy entire histories into KRATT-PRIME subdirectories.
6. Import only approved, licensed adapter contracts and minimal integration glue into PRIME.
7. Keep each product's working code in its own repository. Use tags and immutable provenance records to reference exact source SHAs.
8. Open draft PRs against a non-main integration branch; independent Tester and Auditor review; merge only after CI and evidence gates.

### Suggested branch and repo topology
- Keep current `main` at baseline SHA `4bbd4170a90da7ac0934f185586f53c4cfc9bd5d` untouched.
- Create `integration/source-reconciliation-2026-10` from the observed main SHA.
- Preserve existing duplicate AURA snapshot on a clearly labelled archival branch/tag before any cleanup.
- Add PRIME code only after the definitive source-of-truth mapping. Do not delete the AURA snapshot as part of the initial audit.
- Keep agent role branches and short-lived task branches; do not force-push or rewrite published history.
- Use per-repository mirrors for full history; no giant merge of all products into PRIME.

### Safe full-history mirror procedure (run only after API/token access is configured in a secure local/CI environment)
For each source repository:
```bash
# Keep source intact; clone all refs and tags
git clone --mirror <SOURCE_GIT_URL> <repo>.git
cd <repo>.git
git fsck --full
git bundle create ../<repo>-all-refs.bundle --all
sha256sum ../<repo>-all-refs.bundle
# Push all refs to a new, dedicated mirror destination after confirming destination is empty
git push --mirror <DESTINATION_GIT_URL>
```
For Git LFS:
```bash
git lfs fetch --all
git lfs push --all <DESTINATION_GIT_URL>
```
Do not reuse a non-empty destination or push mirror refs into the existing KRATT-PRIME repo. Mirroring may overwrite remote refs; use an empty, dedicated target repository and verify exact SHA parity first.

## Governed self-improvement loop (the actual learning design)
1. **Observe:** ingest a task, source diff, test result, connector health or runtime event as untrusted data.
2. **Normalize:** produce a typed event envelope with request ID, source repository, exact SHA, timestamp, event type and bounded payload digest.
3. **Verify:** TÖEPÄRA checks provenance, freshness, signature/identity where available, schema, input bounds, test evidence and contradictions.
4. **Remember:** write typed temporal memory records with origin, scope, confidence, validity interval, parent revision and content hash. Keep mutable working memory separate from append-only audit/provenance ledger. Never store credentials, cookies or tokens.
5. **Reason:** KRATT proposes an objective, action plan and measurable acceptance criteria; it cannot grant itself permissions.
6. **Authorize:** external deterministic policy router builds TrustedContext and checks capability leases, path scope, budget, risk level, idempotency key and human approval. Default deny.
7. **Build:** agent may write only to its task branch/workspace and allowlisted paths. It may create a patch, test fixtures, docs and candidate artifact; never directly mutate main, secrets, account permissions, production or protected data.
8. **Verify independently:** Tester runs actual tests/build/security checks; Auditor checks security, privacy, scope, dependency/license and truthful UI state. Record PASS/FAIL/BLOCKED/NOT_RUN with logs.
9. **Integrate:** Integrator prepares a draft PR with source SHAs, evidence capsule, diff summary, SBOM and rollback target. Human approval is required for privileged, destructive or external writes.
10. **Release and learn:** only after approved merge and deployment canary, record release SHA, outcomes, regressions and corrected lessons. Update memory only with verified evidence; rejected suggestions remain labelled rejected, not promoted as truth.

### Non-negotiable invariants
- AI MAY PROPOSE; AI MAY NOT SELF-AUTHORIZE.
- GENERATED != VERIFIED; test configured != test executed.
- UI hiding a control is not authorization.
- No direct unrestricted shell, host execution, credential access or production write for agent processes.
- Secrets live only in scoped server-side secret storage; never in browser/local memory/repo/issue artifacts.
- Every action is idempotent, scoped, attributable, checkpointed and recoverable.
- Source projects remain independent; original history/license must be preserved.

## Ordered execution plan

### P0 — Establish source of truth and GitLab/API access
- Confirm exact GitLab account/groups and access scopes; configure an official GitLab connector or secure CI/local credential. Never paste tokens into chat.
- Obtain GitLab API metadata for every listed project: project ID, SSH/HTTPS clone URL, visibility, license, default branch SHA, branches, tags, LFS, forks, MR status and pipeline IDs.
- Verify whether Lovable project remote is actually `ARHIDEKT/my-side-project` and compare SHA `253f09c...` with GitLab HEAD.
- Read all 4 open MRs and relevant pipelines, including MR !35 and memory branch `feature/kratt-memory-deep-tech-v1`.
- Capture immutable manifests; preserve source repos untouched.

### P1 — Full repository inventory and parity
- Mirror the two STEEL repos separately to dedicated archive mirrors; compare ancestry/diffs/branch coverage and select canonical STEEL integration head.
- Inventory GOLIATH projects and identify canonical repo; compare `main` vs `master`, licenses, commit and pipeline provenance.
- Confirm AURA GitHub repository is the canonical visualizer; do not create a phantom GitLab AURA source if none exists.
- Fully audit FRAME.9 tree and CI run statuses; record its `Forge.-9` branch and main baseline.
- Reconcile all duplicated AURA material currently inside KRATT-PRIME with AURA source.
- Review dependency licenses, generated assets, secrets, env patterns, Git LFS objects, submodules and build instructions.

### P2 — PRIME architecture foundation
- Replace conceptual placeholders only after source reconciliation with real modules: typed job lifecycle, deterministic policy router, capability registry, connector adapter interfaces, versioned API, audit/provenance ledger, approvals and local simulation.
- Integrate KRATT schema + TÖEPÄRA in the PRIME core; keep execution conversion behind an explicitly deferred, sandboxed adapter.
- Define typed memory event/record/query schema, temporal versioning, conflict-resolution and retention/erasure rules. Add a local evidence ledger integration from STE-89 after importing and testing its exact source.
- Add Saga orchestrator with idempotency keys, durable checkpoints, compensation and bounded retry; do not introduce a broad shell executor.
- Bring in agent-kernel taxonomy from STE-64 only after exact source SHA and tests are verified.

### P3 — Integration adapters
- Implement read-only repository adapters first: GitHub/GitLab repository metadata, commit, MR/PR and CI status; then code browsing with path allowlists.
- Integrate FRAME.9, AURA, STEEL and GOLIATH by API contracts and immutable source SHA. No code ownership collapse.
- Integrate TinyFish Agent API as a governed service with run lifecycle, typed outputs, cancellation semantics, budgets and evidence capture; credentials isolated server side.
- Add connector-state machine: NOT_CONNECTED, CONNECTED_READ_ONLY, WRITE_APPROVAL_REQUIRED, VERIFIED, DEGRADED, REVOKED.
- Add webhook signature checking, duplicate suppression, retries, rate limits and append-only connector event log.

### P4 — Quality and platform delivery
- Make baseline typecheck, lint, unit/integration/e2e, license, SBOM/AIBOM, secret scan and provenance checks deterministic.
- Resolve known full-lint baseline separately from changed-code checks; never mask as pass.
- Add Linux/Windows thin clients and Android companion only after core API/policy contracts are stable.
- Build signed APK/MSIX/AppImage only in CI with reproducible build, signing, SBOM and checksum evidence.
- Do not publish/deploy production without a separate explicit approval.

## Current connector status (this audit)
| Service | Result |
|---|---|
| GitHub | Connected and can read/write selected repos; no repo migrations performed |
| GitLab | Browser read-only inspection via TinyFish succeeded; no direct GitLab API connector in this session |
| Lovable | Connected; My Side Project source, files and edit history available |
| Linear | Connected; KRATT project and issues available |
| Asana | Connected; project/task data available |
| Figma | Account visible; Weave linking absent; design file access not verified |
| Slack | Connector calls returned no workspace/conversation payload in this audit; live access not verified |
| Base44 | One app visible: 3XTRINITY KRATT Integration Hub; direct file/sandbox audit blocked by plan requirement |
| TinyFish | Browser profile and one completed authenticated GitLab inspection run available |

## What this audit did NOT do
- No source repository was cloned, mirrored, exported or imported.
- No existing GitHub/GitLab main branch was changed.
- No files or branches were written to source repositories.
- No GitLab API integration was connected.
- No fresh builds, tests, lint, security scans or production deployments were run.
- No secrets or tokens were read or exposed.

**Exit criterion:** do not call KRATT PRIME integrated or self-improving until the canonical source map is signed off, repository history has verified parity, policy and memory adapters have real integration tests, and the governed self-improvement loop has independent evidence-backed approvals.
