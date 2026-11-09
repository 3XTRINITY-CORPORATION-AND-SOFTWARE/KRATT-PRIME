# KRATT PRIME — Kernel-first Evidence Runtime v1

**Status:** executable local reference runtime; not a production service.  
**Baseline:** `feature/node-runtime-supervisor-2026-11-08`.  
**Runtime:** existing Node 22 app contract is unchanged; core modules use built-in Node APIs only.

## Start and endpoints

Set optional `KRATT_*` values from `.env.example` in the process environment, then run `npm run runtime`. Node does not automatically load `.env` in this script. The service binds to loopback, has no write API, and exposes `GET /health/live` plus `GET /health/ready`. Readiness currently reports the injected composition state; it does not prove persistent storage or provider connectivity. `npm run runtime:check`, `npm run lint`, `npm run typecheck` and `npm test` are the expected local checks.

## Architecture increment

- Reuses `packages/kratt-core` Node profile, runtime planner, hardware contracts, memory ledger and hash-chained evidence ledger.
- Adds a local HTTP composition root, strict allowlisted environment configuration, JSON structured logs with sensitive-key filtering, bounded HTTP timeouts, health/readiness, and signal-driven graceful shutdown.
- Adds immutable root claim, branch-scoped ECK cards, provenance checks and reflection. Reflected deltas are proposals only; branch findings never rewrite the root.
- Adds Bayesian log-odds scaffolding that abstains unless each observation carries an explicit calibration identifier and positive likelihood ratio. Records in one dependency group are not multiplied; conflicting records in a group yield `CONFLICTED` and no posterior.
- Adds an injected repository index interface pinned to full commit SHA, capped file/byte budgets, content digests and no write method. It stores metadata only and does not send content anywhere.
- Adds worker and Pico-Cloud description/proposal interfaces. Dispatch remains false; remote targets require an explicit transfer approval signal and still produce no execution.
- `packages/kratt-runtime/src/durable-evidence.mjs` now persists validated ECK cards through the existing fsync'd PrimeStore journal and rebuilds an in-memory projection on open. This is a single-process local journal adapter, not a transactional database or multi-process lock.

## Truth and status vocabulary

The root claim is the versioned canonical assertion. `OBSERVED`, `INFERRED`, `CONFIGURED`, `EXECUTED`, `VERIFIED` and `BLOCKED` are evidence decisions; none alone establishes ontological truth. A calibrated posterior is a statistical estimate under supplied calibration inputs, not truth. Runtime health, branch openness, planning and execution are separate system states.

## Limits and follow-up decisions

- Likelihood ratios and calibration identifiers are caller-supplied. There is no calibration corpus, prior estimator, uncertainty interval or proof that calibration transport is valid. Do not display the posterior as a calibrated production probability until a labelled, leakage-controlled corpus and independent calibration review exist.
- The per-dependency-group minimum absolute log-likelihood contribution is a conservative duplicate-handling heuristic, not a general dependence model. Replace it only with validated dependency structure and back-tested aggregation.
- The core `EvidenceLedger` remains in-memory; the durable wrapper appends ECK records to PrimeStore before updating its projection. PrimeStore is not encrypted, cross-process transactional, signed, or multi-user isolated. Schema v1 records are replayed as-is; a future schema change must build a versioned migration/reprojection path and recovery tests before changing the journal format.
- The repository adapter has no GitHub/GitLab client; callers must supply read-only functions. Add provider scopes, rate budgets and license/secret scanning before connecting external repositories.
- No MCU inference, firmware, hardware route execution, network listener beyond loopback, authentication, account roles, external write, cloud worker, deployment, or privileged operation is implemented.

## Security and dependency policy

This increment adds no dependencies. Preserve `package-lock.json` as the npm lockfile authority and use `npm ci`; Node is constrained by the existing `.nvmrc` and `engines`. Any dependency addition must justify necessity, declare a reviewed supported semver range, update the npm lockfile with npm, and receive vulnerability/license review before merge. Do not log environment contents or secrets. Public bind, remote data transfer and external mutation require separate reviewed capability and approval work.
