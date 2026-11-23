# KRATT PRIME — Next Architecture Workstreams (2026-11-08)

**Working source:** feature/hardware-aware-runtime-v0.2.0-2026-11-07  
**Canonical integration target:** to be confirmed by source-reconciliation review; do not target main while the AURA/KRATT source split remains unresolved.  
**Policy:** no merge, deployment, credential change or external write is included.

## New isolated work branches

| Branch | Scope | Main artefacts | Merge prerequisite |
|---|---|---|---|
| feature/node-runtime-supervisor-2026-11-08 | Node.js host runtime and profile | Runtime architecture, read-only Node profile module, tests, Node 22/24/26 CI | Tests pass; Node version changes remain separate |
| feature/evidence-branch-reflection-bayes-2026-11-08 | EHK-LPR-BPR branch/reflection model | Typed claim/evidence/delta contracts, dependence-aware Bayes design, plugin capability matrix | Owner glossary, labelled calibration corpus and dependency validation |
| feature/pico-cloud-edge-compute-2026-11-08 | Local-first edge and private worker tier | MCU/edge/private-worker topology, data/security boundaries, acceptance matrix | Single-host resource, recovery and security tests |
| feature/repository-intelligence-eck-lore-2026-11-08 | Repository beacon and knowledge graph | ECK/Lore design, source lineage, revision-aware retrieval | Read-only connector evidence, licence/secret controls, retrieval benchmark |

All four branches were created as children of feature/hardware-aware-runtime-v0.2.0-2026-11-07. They are intentionally isolated and have not been merged into one another.

## Recommended integration order

1. **Node host profile + supervisor contract.** Keep the root app's Node 22 pin unchanged until the full package/dependency matrix passes.
2. **Repository intelligence.** Pin content to exact commit/blob digests and measure retrieval before indexing more repositories.
3. **Evidence reflection.** Build typed deltas and source/dependency lineage; begin with duplicate-source elimination and abstention before complex copulas.
4. **Pico-Cloud.** Start as one local host; add a remote worker only after resource budgets, identity, queue leases, recovery and transfer approval are tested.
5. **Cross-branch integration.** Create a separate integration branch from the agreed source ref, cherry-pick or merge reviewed commits, run the full suite, then open Draft PRs to the approved target.

## Explicit non-goals in this increment

- No changes to main, AURA root app metadata, existing Draft PRs or the original hardware-runtime branch.
- No merge, release, deploy, public service, self-provisioning or credential/role changes.
- No production Node 26 migration.
- No MCU model, firmware, eBPF attach, packet-filter change or privileged host operation.
- No claim that research connectors or listed plugins are live integrations without a verified response and scope record.

## Completion evidence

Each branch must supply commit SHA(s), changed-file list, CI run(s), validation outputs and a human-reviewed acceptance record. The architecture documents describe intended behaviour; they do not certify implementation.
