# Branch Divergence Audit — Hardware Runtime v0.2.1

**Audit date:** 2026-11-07  
**Repository:** `antonioportfelli-boop/KRATT-PRIME`  
**Scope:** Read-only lineage and PR audit for the active Hardware Runtime branch. No merge, rebase, force-push, or reconciliation was performed.

## Source of truth observed

| Item | Observed value | Evidence |
|---|---|---|
| Default branch | `main` | GitHub repository metadata |
| Active feature ref | `feature/hardware-aware-runtime-v0.2.0-2026-11-07` | PR #12 head ref |
| Active feature head | `953803432bd9d255dfd1c5afdcb7ec29a676a677` | PR #12 and commit metadata |
| PR #12 | Open, Draft | GitHub PR #12 metadata |
| PR #12 base | `work/kratt-prime-roadmap-v3-2026-11-06` | GitHub PR #12 metadata |
| PR #12 base SHA observed | `1f74448b31e5cfc5b8376be2ef4c6e09d8493d40` | GitHub PR #12 metadata |
| PR mergeability | `mergeable=false`, state `dirty`, `rebaseable=false` | GitHub PR #12 metadata |
| `main` tip observed | `55a849ea11370dbd3b4ee1c688306dfb095f843e` | GitHub branch metadata |

The observed main tip is a snapshot for this audit, not proof about any earlier or later moment. No `main` write was made during this audit.

## Divergent commit inventory

PR #12 describes the branch as **13 commits ahead and 8 commits behind** its roadmap base. The commit ancestry exposed by GitHub records the following 13 feature-side commits (oldest to newest):

1. `79a4673d0a7bca42e5cfc28b8cb947d5a725592c` — `feat(runtime): add hardware-aware capability contract`
2. `c21399aca52b85f3c72471ea605e575aed4cbc11` — `feat(runtime): add hardware-aware capability contract`
3. `427fb315611eaa0c0ba60aa07e895f233abc52f5` — `feat(runtime): add hardware-aware capability contract`
4. `b6031fcae1e825791e1a225ab2d3be679ebebb9b` — `feat(runtime): add hardware-aware capability contract`
5. `2d17c82bb0f2fa568071af319aa97b81f95cce08` — `feat(goliath): add safe packet telemetry and kinetic analysis slice`
6. `17f0601cb5a3f4032507578b8a68b6930c20179c` — `fix(goliath): validate telemetry config and add Rust CI`
7. `1b28597a3834a41f7820bf60dc5593056173d670` — `feat(kratt): add read-only Linux operations intelligence`
8. `9f3273317ea1ab4743efbc1c3b5431915ebb219f` — `test(kratt): cover full core suite in Linux diagnostics CI`
9. `81776d32ef9c92118e034de19cb6551b8551e2c2` — `fix(kratt-core): validate hardware snapshots before routing`
10. `5e5a1155c19b3a21c0775af92b208b1b21d7857b` — `test(kratt-core): cover route envelopes and forged snapshots`
11. `381f1a533398d0a96aeb7c5be9fbe7ef9f1babd2` — `ci: include roadmap draft PR target`
12. `89f217a13de5f67f6cfbf0983c647bd9706989a3` — `ci: include roadmap draft PR target`
13. `953803432bd9d255dfd1c5afdcb7ec29a676a677` — `ci: add hardware runtime contract checks`

The eight roadmap-side commits after the shared `c99be6070fb3cfbb1338ccd2cf4be6297ed2b051` ancestor, as exposed by the roadmap ancestry, are:

1. `5d05a2ed13c6ece0c1d919864cfb89d8a2953037` — `feat(runtime): add hardware-aware capability contract`
2. `f4c5b28302fb9dff0edf7dac8b2e4af4f3004fd3` — `feat(runtime): add hardware-aware capability contract`
3. `1e265046095d3df7f3eaf1dd0eb566856e6e137b` — `feat(runtime): add hardware-aware capability contract`
4. `5e3486d760f57f2ca814e133fb8d59450bf5b246` — `feat(runtime): add hardware-aware capability contract`
5. `ff966ae4fa70026934957cf51827874c3436807c` — `feat(goliath): add safe packet telemetry and kinetic analysis slice`
6. `f76158cb179f7fc3128c61aced5db72f0ff34e37` — `fix(goliath): validate telemetry config and add Rust CI`
7. `58674ec0774f410a283a48144c24bfca13f0fd2a` — `feat(kratt): add read-only Linux operations intelligence`
8. `1f74448b31e5cfc5b8376be2ef4c6e09d8493d40` — `test(kratt): cover full core suite in Linux diagnostics CI`

The counts and parent relationships are consistent with the PR's 13-ahead/8-behind report. GitHub's available compare response exposed patches, not a local `git merge-base` result; therefore no locally executed `git merge-base`, `git log --left-right`, or full working-tree status is claimed here.

## File-level overlap and conflict-risk map

The PR #12 changed-file listing marks these 16 paths as added relative to its selected base. This does **not** mean the paths are safe to transplant: the roadmap side has parallel commits with overlapping hardware/runtime, Linux diagnostics and GOLIATH subject matter, and GitHub reports the PR as dirty.

| Area | PR #12 paths | Risk |
|---|---|---|
| CI workflows | `.github/workflows/goliath-kernel.yml`; `.github/workflows/hardware-runtime-tests.yml`; `.github/workflows/linux-operations-tests.yml` | **High** — branch filters and workflow paths may differ across the two sides; validate event/target coverage and avoid dropping either workflow's test steps. |
| Hardware runtime | `packages/kratt-core/src/hardware-capabilities.mjs`; `packages/kratt-core/test/hardware-capabilities.test.mjs`; `docs/runtime/HARDWARE-AWARE-RUNTIME-V0.2.0.md` | **High** — parallel hardware contract commits are present on both histories; compare schema, validation and routing behavior rather than choosing a side by recency or file name. |
| Linux Operations | `packages/kratt-core/src/linux-operations.mjs`; `packages/kratt-core/src/linux-diagnostics-cli.mjs`; `packages/kratt-core/test/linux-operations.test.mjs`; `docs/runtime/LINUX-OPERATIONS-INTELLIGENCE.md` | **High** — both histories contain Linux Operations development; review fixed command allowlists, privacy treatment, error states and diagnostics extensions for duplication or behavioral regressions. |
| GOLIATH | `packages/goliath-kernel/Cargo.toml`; `packages/goliath-kernel/Cargo.lock`; `packages/goliath-kernel/src/lib.rs`; `packages/goliath-kernel/bpf/goliath_xdp.c`; `packages/goliath-kernel/README.md` | **High** — both histories contain GOLIATH implementation and Rust CI changes; verify ABI/config/parser consistency and keep XDP pass-only. Cargo source and lockfile must be treated as a unit. |
| Runtime index | `docs/runtime/README.md` | **Medium** — potential documentation overlap; preserve product boundaries and correct status statements. |

**Total PR #12 paths:** 16. The GitHub PR file listing was used as the precise path inventory. The compare patch also showed roadmap-only documentation absent from PR #12, including `docs/MASTER-DEVELOPMENT-ROADMAP-v3.md`, `docs/agents/AGENT-RUNTIME.md`, `docs/architecture/SOURCE-OF-TRUTH.md`, `docs/architecture/SYSTEM-ARCHITECTURE.md`, `docs/design/industrial-night-ui-spec.md`, several `docs/engineering/*` files, `docs/integrations/*`, `docs/memory/MEMORY-ARCHITECTURE.md`, and `docs/security/*`. These roadmap files are not included in the PR #12 transfer set and must not be overwritten as part of reconciliation.

### Newer/stacked work warning

PR #13 (`feature/kratt-prime-5x-runtime-v3-2026-11-07`) is also open and Draft. Its base is PR #12's feature ref and its head is `1ce08d3a1dd98b70fcdf5c0fd4b7dc326f283006`. Its description reports expanded Linux discovery, a hardware-aware planner, additional tests and GOLIATH compatibility notes. This is evidence of newer stacked work, not evidence that it is already present in PR #12 or that it passed every check. PR #13 and all other existing Draft PRs were left unchanged.

## Why GitHub reports mergeable=false

GitHub currently reports `mergeable=false`, `mergeable_state=dirty`, and `rebaseable=false` for PR #12 against the roadmap base. The exact low-level conflict hunks were not exposed by the available read-only API response. Given the 13/8 divergent histories and parallel additions to the same hardware, Linux Operations and GOLIATH areas, the likely conflict class is overlapping/add-add changes, but that is an assessment—not a verified conflict-hunk diagnosis. A local merge-base and three-way conflict simulation are still required before any proposed reconciliation.

## Non-destructive reconciliation proposal (not executed)

1. Preserve PR #12 and its current feature ref as historical evidence; do not rebase or force-push it.
2. Start a separately named candidate from the explicitly chosen roadmap base SHA, after confirming the user still wants that target.
3. Review the eight roadmap-side and 13 feature-side commits individually, then transfer only accepted code/doc changes in small, traceable commits. Do not blindly merge `main` or cherry-pick the whole feature branch.
4. Compare the candidate tree with the roadmap tree, PR #12 tree and newer stacked PR #13 tree. Explicitly identify behavior retained, superseded or deferred for each overlapping path.
5. Run exact Node 22 focused and full tests plus Rust tests on the candidate. Keep the candidate Draft; do not merge.
6. Ask for review of the final tree, commit ancestry and test/CI evidence before any later action.

## Verification evidence and limits

- PR #12 remained open and Draft at the time queried; its base remained `work/kratt-prime-roadmap-v3-2026-11-06` and head remained `953803432bd9d255dfd1c5afdcb7ec29a676a677`.
- GitHub Actions run [42325963098](https://github.com/antonioportfelli-boop/KRATT-PRIME/actions/runs/42325963098) is recorded as completed with conclusion `success` on the exact feature head SHA. Its workflow is `KRATT Hardware Runtime contract tests`. The available job-log lookup returned “No failing jobs found”; detailed per-step/job output was not available from that lookup, so this report does not independently attribute every individual test command to a passed step.
- PR #12's description cites earlier Linux Operations run [42324258334](https://github.com/antonioportfelli-boop/KRATT-PRIME/actions/runs/42324258334), but its exact run metadata was not independently recovered in this audit.
- No local worktree/terminal is available in this audit session. Therefore `git status`, `git merge-base`, `git diff --check`, local Node commands, and Cargo commands were **not run here**.
- GOLIATH eBPF compilation and verifier acceptance are not established by the Rust workflow.

## Safety record

No rebase, merge, force-push, branch deletion, PR edit, `main` write, privileged host operation, network reconfiguration, secret access, deployment or release was performed for this audit.
