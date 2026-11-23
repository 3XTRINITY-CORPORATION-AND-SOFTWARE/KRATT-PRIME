# CHIRO-X Wave 2 dependency map

Status: based on source and tests at CHIRO-X SHA 15df6507a5bbff92a4f5b41e3f4daf0258d2cb9f.

## Reusable components

| Concern | Existing component and public seam | Consumers and current limit |
|---|---|---|
| PIP boundary | packages/kratt-core/src/pip-contracts.mjs: validatePIPPrivacy, validatePIPObservation, validatePIPInterpretation, validatePIPBundle, validatePIPEvent | CHIRO runtime and tests; schema is PIP-specific, not an agent task lifecycle contract |
| CHIRO evaluation | packages/kratt-core/src/chiro-x.mjs: registerChiroAgents, evaluateChiroBundle, createChiroEvent, createChiroWorkflow, transitionChiroWorkflow | Enforces observation/interpretation separation and injected verification; surface divergence is explicitly not semantic truth |
| CHIRO provider seam | packages/kratt-core/src/chiro-phase11-pipeline.mjs: createChiroPhase11Pipeline({visionProvider, interpretationProvider, verifyInterpretation, eventSink}) | Called by tests and injectable into Phase 11; providers are not centrally routed, and the Saga is transient |
| Agent registry | packages/kratt-core/src/agent-registry.mjs: registerAgent, registerTool, authorize | Scope lists and active/disabled state; no task scheduler, version negotiation, health, lease, budget, or revocation lifecycle |
| Saga | packages/kratt-core/src/saga.mjs: createSaga, transitionSaga | Pure immutable transition helper; no durable recovery or operation execution |
| Phase 11 runtime | packages/kratt-orchestrator/src/phase11-runtime.mjs: createPhase11Runtime | Wraps phase-upgrade-engine in Wave 10 observability; exposes propose, execute, commitApproved, runSemanticPipeline, getRun, watchEvents |
| Semantic stages | packages/kratt-orchestrator/src/semantic-agent-pipeline.mjs: createSemanticAgentPipeline | Ordered extract/contextualize/classify/review with Talmud and Anti-Talmud gates; uses Word Semantic v2, not general PIP tasks |
| Evidence reflection | packages/kratt-core/src/motlemine-engine.mjs: createMotlemineEngine({verifyEvidence}) | Validates evidence records, checks source independence, dependencies and cycles, and reports conflict; assessments are not final truth or authorization |
| Semantic integrity | packages/kratt-core/src/meridian-truth-chain.mjs: createMeridianTruthChain | Word Semantic v2 source-origin integrity and correction proposals; not a general PIP graph |
| Semantic provenance graph | packages/kratt-core/src/semantic-evidence-bridge.mjs: createSemanticEvidenceBridge | Builds a typed graph for Word Semantic records and an injected ledger/verifier; not a general PIP evidence adapter |
| Memory | packages/kratt-core/src/memory-ledger.mjs: MemoryLedger | Explicitly in-memory/test-local only; not durable production storage |
| Authorization | policy.mjs, trusted-runtime.mjs, async-trusted-runtime.mjs, authorized-dispatch.mjs | Existing request-bound KRATT policy and approval path; reuse it rather than creating another authorization engine |
| Durable dispatch | postgres-outbox-store.mjs and outbox-worker.mjs | Transactional intent, replay protection, lease token, bounded retry and append-only audit patterns; adapter dispatch is at-least-once and requires idempotency |
| Runtime observability | runtime-observatory.mjs, observed-operation.mjs, postgres-runtime-observatory-store.mjs, runtime-observatory-api.mjs | Wave 10 operation lifecycle and protected read API; no Wave 2 task API is currently mounted |
| Local commands | sqlite-command-store.mjs and sqlite-nonce-store.mjs | Durable local command/nonce adapters with different deployment guarantees from shared Postgres |
| Existing UI | programs/web/kratt-control-desk/{index.html,app.js,styles.css} | Read-only wave inventory and Observatory view; it is separate from the AURA visualizer |
| STEEL adapter | packages/kratt-core/src/steel-factory-protocol-adapter.mjs | Closed-schema Factory Protocol adapter with injected independent receipt verification; upstream STEEL source is outside this branch |

## Intended dependency direction

1. External requests enter through a strict versioned Wave 2 contract boundary.
2. The runtime validates the task and DAG, resolves registered capabilities, then requests authorization through the existing KRATT policy seam.
3. Authorized local agents execute with an immutable context, bounded resources, AbortSignal, and provider/evidence interfaces.
4. Agent/provider output is validated before it can enter the evidence evaluator.
5. PIP evidence is adapted into the existing KRATT evidence/MÕTLEMINE conventions; model output never verifies itself.
6. Task and policy events use the shared Wave 2 contract and existing Wave 10 observability adapter.
7. The Control Desk consumes a protected same-origin API. It does not grant capabilities or establish verified state.

## Ownership and cycles

- packages/kratt-core is the shared contract and policy layer.
- packages/kratt-orchestrator may depend on kratt-core; kratt-core must not import the orchestrator.
- The standalone Control Desk may import stable core data needed for static display, but core modules must not import UI code.
- No shared database migration is planned until a concrete durable Wave 2 store interface is justified. The existing Postgres outbox must not be misrepresented as a complete persisted DAG/Saga store.
- No duplicate AgentRegistry, Saga, policy engine, Wave 10 observability store, or Word Semantic evidence graph is authorized.

## External boundaries

KRATT-PRIME is the only repository in implementation scope. AURA, STEEL, FRAME.9, GOLIATH OS, provider accounts, and other external services remain read-only. This CHIRO-X branch has no STEEL application source or GOLIATH runtime source. The existing STEEL adapter and explicit contracts are the only permitted integration seams until separate repository authority and source revisions are verified.
