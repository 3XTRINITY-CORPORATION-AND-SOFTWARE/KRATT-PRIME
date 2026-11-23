# CHIRO-X Wave 2 repository boundaries

## Authorized implementation scope

- Repository: antonioportfelli-boop/KRATT-PRIME.
- Starting source branch: feature/chiro-x-pattern-intelligence-v1 at 15df6507a5bbff92a4f5b41e3f4daf0258d2cb9f.
- Integration branch: feature/chiro-x-wave2-intelligence-fabric, created at that exact SHA.
- Target PR base: feature/chiro-x-pattern-intelligence-v1.
- main is not a development target. PR #47 remains open and draft, and will not be merged.
- The repository's INTEGRATION-GOVERNANCE states KRATT PRIME is the only repository in scope and external AURA, STEEL, FRAME.9, GOLIATH OS, and services are read-only absent separate authorization.

## In-repository products and interfaces

- packages/kratt-core contains KRATT contracts, policy, evidence, Saga, outbox, observability, and the existing STEEL Factory Protocol adapter.
- packages/kratt-orchestrator contains Phase 11 runtime and provider/semantic composition.
- programs/web/kratt-control-desk is the existing KRATT control-plane UI and is the only appropriate UI surface for this work.
- The repository-root src application is the AURA visualizer, not the KRATT operations console. Do not add CHIRO review controls there.
- programs/os describes a future AURA shell and explicitly does not absorb STEEL.
- This CHIRO-X head has no STEEL application source and no GOLIATH runtime source. The main branch contains separate GOLIATH-related material, but Wave 2 must not import unrelated main code into this branch.

## STEEL

Use packages/kratt-core/src/steel-factory-protocol-adapter.mjs and existing documentation as the integration boundary. Do not recreate or fork the upstream Factory Protocol schema. The current checkout does not include a STEEL application worktree or a live integration environment. No separate STEEL repository write, deployment, or release is authorized.

## GOLIATH

The CHIRO-X branch does not contain GOLIATH OS runtime code. Keep the Wave 2 authorization/audit adapter inside KRATT PRIME and describe the external GOLIATH interface required. Do not copy a second GOLIATH service or claim that GOLIATH is connected.

## Provider and deployment boundary

External model/provider use remains disabled by default. No credentials, provider account configuration, webhook, external write, production deployment, publication, release, or environment change is part of this work. A mock transport is not evidence of a live provider connection.

## UI boundary

Extend the Control Desk only where its read-only architecture supports truthful display. Do not add a fake endpoint or make the current static UI claim that task, evidence, or human-review APIs are mounted. If no protected backend endpoint is available, keep the UI unbound and document the needed server adapter.
