# KRATT PRIME Evidence Runtime — Next Stages v1

**Purpose:** dependency-ordered implementation stages for the first local evidence runtime. This is a work plan with explicit completion gates, not a claim that later stages exist.

## Current baseline

The current code provides a Node 22 runtime foundation, typed evidence/branch/reflection contracts, an intentionally abstaining Bayesian scaffold, a hash-chained local evidence journal, a local Git read-only source pinned to immutable commit SHA values, metadata-only repository indexing, and typed ECK observations. The current feature slice adds the bridge from those indexed observations into the durable journal.

## Stages

| Stage | Focus | State | Acceptance gate |
| --- | --- | --- | --- |
| 0 | Runtime and core contracts | Present in prior feature branches | Node 22 entry/config/logging/health/shutdown; typed evidence and branch contracts; current package tests pass. |
| 1 | Durable ECK journal | Present in `feature/durable-evidence-projection-v1` | Restart recovery, corruption rejection, idempotency, single-writer limitation documented. |
| 2 | Local repository evidence source | Present in `feature/local-git-eck-index-v1` | Fixed shell-free Git reads; immutable revision; bounded metadata index; secret-path filter; ECK provenance to root and branch. |
| 3 | Durable repository-index pipeline | This branch: `feature/repository-index-eck-durable-v1` | Pinned metadata becomes ECK events, persisted one-by-one; exact retry is idempotent; partial writes report progress and can resume with identical inputs. |
| 4 | Reflected evidence snapshots | Next | Rebuild branches from persisted evidence; validate root/branch/revision mappings against journal records; invariants must be executable checks with provenance, not caller-supplied booleans; deltas remain proposals. |
| 5 | Evidence quality and calibration research | Blocked on representative labeled data | Pre-register evaluation set, dependency groups, decision thresholds, calibration metrics and confidence intervals; compare against baselines; retain abstention and selective-prediction failure reporting. No posterior claims before independent validation. |
| 6 | Runtime operator surface | After Stage 4 | Local-only CLI/API for inspect/index/verify; explicit repository path and immutable SHA; read-only default, bounded request sizes, redacted logs, readiness includes journal verification. |
| 7 | Worker and Pico-Cloud preparation | After threat model and privacy review | Describe/plan contracts first; no dispatch until capability approval, data classification, consent, budgets, idempotency and audit gates are tested. |
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

## Deferred decisions

- Whether repository path selection needs user confirmation in the local CLI and how consent is recorded.
- Which content types (if any) may be parsed beyond UTF-8 text, and the malware/secret scanning policy.
- Journal encryption, key ownership, retention, backup and restore policy.
- A statistically justified aggregation policy and operational error thresholds.
- A supported hardware matrix and MCU algorithm requirements.

