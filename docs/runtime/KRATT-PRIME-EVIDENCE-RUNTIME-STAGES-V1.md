# KRATT PRIME Evidence Runtime — Next Stages v1

**Purpose:** dependency-ordered implementation stages for the first local evidence runtime. This is a work plan with explicit completion gates, not a claim that later stages exist.

## Current baseline

The current code provides a Node 22 runtime foundation, typed evidence/branch/reflection contracts, an intentionally abstaining Bayesian scaffold, a hash-chained local evidence journal, a local Git read-only source pinned to immutable commit SHA values, metadata-only repository indexing, and typed ECK observations. The current feature slice adds the bridge from those indexed observations into the durable journal.

## Stages

| Stage | Focus | State | Acceptance gate |
| --- | --- | --- | --- |
| 0 | Runtime and core contracts | Present in prior feature branches | Node 22 entry/config/logging/health/shutdown; typed evidence and branch contracts; current package tests pass. |
| 1 | Durable ECK journal | Present in `feature/durable-evidence-projection-v1`; writer-lock hardening on this branch | Restart recovery, corruption rejection, idempotency; exclusive local writer lock rejects concurrent/stale writers. A crash-stale lock needs operator recovery; no multi-host or transaction guarantee. |
| 2 | Local repository evidence source | Present in `feature/local-git-eck-index-v1` | Fixed shell-free Git reads; immutable revision; bounded metadata index; secret-path filter; ECK provenance to root and branch. |
| 3 | Durable repository-index pipeline | This branch: `feature/repository-index-eck-durable-v1` | Pinned metadata becomes ECK events, persisted one-by-one; exact retry is idempotent; partial writes report progress and can resume with identical inputs. |
| 4 | Reflected evidence snapshots | This branch: `feature/persisted-evidence-reflection-v1` | Rebuild branches from persisted evidence; validate root/branch/revision mappings against journal records; invariants must be executable checks with provenance, not caller-supplied booleans; deltas remain proposals. |
| 5 | Evidence quality and calibration research | Blocked on representative labeled data | Pre-register evaluation set, dependency groups, decision thresholds, calibration metrics and confidence intervals; compare against baselines; retain abstention and selective-prediction failure reporting. No posterior claims before independent validation. |
| 6 | Runtime operator surface | This branch: `feature/local-evidence-operator-api-v1` | Local-only CLI/API for inspect/index/verify; explicit repository path and immutable SHA; read-only default, bounded request sizes, redacted logs, readiness includes journal verification. |
| 7 | Worker and Pico-Cloud preparation | Proposal, lease, and recoverable audit preparation on `feature/durable-worker-leases-fencing-v1` | Typed admission, metadata audit, durable idempotency reservations, bounded leases and fencing are implemented; the proposal/lease/ECK saga compensates or reports partial state; remote dispatch remains blocked. See both Stage 7 docs. |
| 8 | Hardware and MCU validation | Hardware-dependent | Named target board/toolchain, reproducible firmware build, hardware-in-loop evidence, resource and safety measurements; no algorithm or performance claim before measurement. |

## Rules across stages

- Keep ontology/world truth, evidence state, calibrated probability, and runtime/system state as separate fields and APIs.
- Do not count correlated files or derivative records as independent evidence.
- Every index record must preserve source revision and digest provenance while keeping raw repository content out of persisted evidence.
- Any batch that can partially persist must be idempotent and expose a resume path. Never conceal partial progress.
- Reflection may reject, conflict, or propose a delta; it must never rewrite the canonical root automatically.
- External adapters remain describe-only or dry-run until the exact capability and approval boundary is implemented and tested.
- Hardware and statistical claims require empirical datasets and repeatable evaluation, not architectural intent.

## Stage 3 operational contract

`persistRepositoryIndexEvidence` requires the same pinned root, open branch, actor and explicit UTC event time for every retry. It writes sequentially through `DurableEvidenceRepository`, returns persisted cards and duplicate counts, and reports `PARTIAL` if a later append fails. Replaying the exact request is safe because event IDs are derived deterministically from root, branch, commit and path while the timestamp and provenance remain fixed. Cross-process transactions are not provided; use one journal writer as documented by Stage 1.

## Stage 4 reflection contract

`reflectPersistedEvidence` reads only verified durable cards, checks journal heads both before and after pagination, and rejects a moving or incomplete snapshot. It recreates declared branches from the supplied root claim, derives provenance, duplicate-ID and repository-revision invariants, and then calls the reflection kernel. Callers cannot pass invariant booleans. A validated result remains `PROPOSED_ONLY`; contradictory `VERIFIED` and `BLOCKED` observations yield `CONFLICTED`, and no root update is applied.

## Deferred decisions

- Whether repository path selection needs user confirmation in the local CLI and how consent is recorded.
- Which content types (if any) may be parsed beyond UTF-8 text, and the malware/secret scanning policy.
- Journal encryption, key ownership, retention, backup and restore policy.
- A statistically justified aggregation policy and operational error thresholds.
- A supported hardware matrix and MCU algorithm requirements.

## Stage 7 proposal contract

`createWorkerProposal` validates exact versioned inputs, intersects authority scopes and checks deadlines, cost, data class and kill-switch state. Remote admission requires exact actor/task/worker/target/data-class-bound consent and approval accepted by injected trusted verifiers. Every result remains non-dispatching. Proposal outcomes can be recorded as metadata-only durable ECK events with deterministic idempotent IDs. Trusted cryptographic verifiers, worker isolation, cancellation and transport are not implemented; see `WORKER-PICO-CLOUD-PROPOSALS-V1.md` before any future execution work.

## Stage 7.1 lease contract

`createWorkerLeaseCoordinator` appends idempotent operation records to `PrimeStore`, binds reservation keys to task digests, serializes coordinator objects sharing one store instance in one process, and rejects stale owner/fencing pairs. `reserveWorkerProposal` links only a policy-produced proposal object to its reservation key and digest. Leases expire after bounded intervals. This is a local single-writer coordination primitive only: it does not authenticate worker IDs, provide cross-process transactions, record task completion, or authorize any side effect. Dispatch remains disabled. See `WORKER-LEASES-FENCING-V1.md`.

## Stage 7.2 lease observability

The optional loopback-only `GET /leases/status` endpoint and `/health/ready` integration expose aggregate counts and integrity state only. `KRATT_LEASE_JOURNAL_PATH` must be an explicit absolute local path. Reservation keys, owners, task digests, fences and expiry times remain private. The endpoint is read-only and no lease mutation is exposed through HTTP.

## Stage 7.3 proposal and lease audit saga

`reserveAndAuditWorkerProposal` appends a deterministic metadata-only proposal ECK event, reserves its lease, then appends a deterministic lease receipt. These separate journals do not form a transaction. Receipt-write failure triggers a fenced compensating release; failed compensation returns `PARTIAL` with the bounded lease expiry, and an exact retry can persist the missing receipt while that lease remains current. Inputs to the retry include the original event timestamp. Recovery records evidence only and cannot dispatch. Process-crash reconciliation across both journals, lease-release audit, authenticated worker ownership and any side-effect boundary remain future gates.


