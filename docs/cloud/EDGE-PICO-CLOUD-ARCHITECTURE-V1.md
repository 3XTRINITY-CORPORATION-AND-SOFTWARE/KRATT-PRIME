# KRATT PRIME — Pico-Cloud and Edge Compute Architecture

**Status:** Target architecture and phased build plan; no cloud cluster or remote worker is claimed to exist.
**Parent source:** `feature/hardware-aware-runtime-v0.2.0-2026-11-07`

## 1. Design objective

Build a small self-hosted compute tier that extends a constrained device without making the device dependent on a permanent public cloud. Start with one local host, then add a second worker only after the first deployment proves its resource, security, recovery and operational requirements.

"Pico-Cloud" is KRATT PRIME's name for this small, self-managed edge/cloud tier. It is not a claim that a new commercial cloud provider or globally available service already exists.

## 2. Three-tier placement

```text
Tier 0 — MCU / sensor
  small deterministic model, fixed memory budget, local response
  native firmware/runtime; no Node.js requirement
          |
          | bounded telemetry / result / request
          v
Tier 1 — Edge host (Linux SBC / mini-PC / workstation)
  Node.js supervisor + KRATT Core
  local RAG/index + SQLite + worker processes
  CPU/GPU/NPU provider adapters, model cache
          |
          | only approved, minimized task envelope
          v
Tier 2 — Optional private worker node
  Node.js control/worker service
  heavier model or repository indexing job
  transactional shared state + artifact store
          |
          v
Reflection gate → versioned root delta
```

### Tier responsibilities

| Tier | Primary role | Runtime | Network default |
|---|---|---|---|
| MCU | Sensor processing, deterministic classification, wake/trigger | Native C/C++/Rust or vendor SDK inference runtime | Disconnected; only approved compact messages |
| Edge host | Main local KRATT operation, repository RAG, Node supervision, local policy | Node.js plus native/WASM/ONNX-class workers | Local network only |
| Private worker | Optional expensive inference, indexing and batch evaluation | Isolated worker service, controlled by Node supervisor | Private authenticated channel; deny by default |

Android, Windows and Linux are host adapters, not assumptions that every device supports the same accelerator or virtualization facilities. Android may use its native platform bridge; Node is not assumed to be embedded in every Android app or MCU.

## 3. Build in this order

### Phase A — Single-host local-first MVP

- Run one KRATT Core Node service on a user-controlled Linux mini-PC or workstation.
- Use a single-host transactional store for tasks, memory, evidence and idempotency; SQLite is a candidate after atomicity/recovery tests.
- Keep document blobs content-addressed and local. Start repository retrieval with source metadata and lexical search; add vector embeddings only when a benchmark justifies the memory and dependency cost.
- Use bounded local worker processes with explicit CPU, memory, output and wall-clock budgets.
- Keep all remote execution disabled by default.
- Provide a local API protected by authenticated sessions and loopback binding unless LAN access is explicitly configured.

### Phase B — One additional private worker

- Add a separate worker host only when local CPU/RAM/accelerator measurements show a repeatable bottleneck.
- Use a durable queue, task leases, fencing tokens, cancellation, bounded retries and dead-letter records.
- Use shared transactional storage for authoritative coordination. Do not use independent local SQLite files as a distributed database.
- Authenticate nodes mutually; scope each node to named job types, repositories, data classes and resource limits.
- Return execution receipts, source revision, model digest, hardware profile and resource metrics to the reflection engine.

### Phase C — Resilient private cluster

Only after Phase B acceptance: add multiple workers, health-based scheduling, capacity-aware admission, signed node identity, failover, backup/restore, audit retention, key rotation and operational runbooks. Kubernetes is not the MVP default; introduce a full cluster orchestrator only when there are enough nodes and operational needs to justify its resource and maintenance cost.

## 4. Storage and data flow

- **Control state:** transactional database, one authoritative writer/consistency model for job leases and approval/nonce state.
- **Evidence:** append-only journal with stable event IDs, source revisions and content hashes; production requires durable atomic writes and trusted signed checkpoints.
- **Repository content:** content-addressed cache keyed by repository, commit SHA, path and blob digest.
- **Model artefacts:** manifest with model digest, format, quantization, target ABI, licence, source and benchmark evidence.
- **Embeddings/index:** derived cache only; rebuildable from canonical source references.
- **Metrics:** resource, queue, latency and failure telemetry with sensitive-value redaction.

Do not let a derived vector index become the canonical source of truth. Retrieval output must retain the file/commit/page/record reference that produced it.

## 5. Security and privacy boundary

1. No remote fallback without a request-bound approval that identifies the provider/node, job class, data classification, payload digest and expiry.
2. Minimize data before transfer; send only the material required for the job. Raw sensor streams, private repositories and user data remain local unless expressly authorized.
3. Encrypt network traffic; use authenticated node identity and short-lived scoped credentials. Keep credential contents out of task payloads, logs and model prompts.
4. Encrypt persistent storage and backups with a controlled key lifecycle. Hashes detect content changes but do not replace signatures or authorization.
5. Treat worker containers/processes as untrusted; use unprivileged identities, read-only mounts where possible, filesystem/network restrictions, CPU/memory quotas and seccomp/Landlock/systemd controls where supported.
6. Reject prompt-injection instructions inside retrieved files and remote worker output. They are data, not authority.
7. Keep GOLIATH eBPF/XDP pass-only until the separate verifier/kernel/attach/detach/rollback matrix is satisfied. No network packet drop/redirect policy is enabled by this design.
8. Do not use fully homomorphic encryption as a default MCU retrieval path. Its computational and ciphertext overhead must be measured; begin with ordinary authenticated transport, data minimization and at-rest encryption. Consider encrypted computation only for a specific threat model and a measured workload.

## 6. Resource-aware scheduling

Each task declares:
- allowed backends and locality constraint;
- estimated and maximum RAM, CPU, accelerator memory and output size;
- deadline, cancellation policy and idempotency key;
- data class and remote-transfer eligibility;
- model artifact digest and minimum runtime ABI;
- required evidence and success predicate.

Admission rejects a job that cannot fit the measured budget. Route states remain explicit: `DETECTED`, `AVAILABLE`, `COMPATIBLE`, `PROPOSED`, `AUTHORIZED`, `RUNNING`, `VERIFIED`. No state may be inferred from the previous one.

## 7. Offline and degraded operation

- Local read-only retrieval and local inference continue when the private worker is offline.
- Remote-only tasks become `BLOCKED_REMOTE_UNAVAILABLE`; do not silently upload to another provider.
- Queue only idempotent, explicitly permitted work.
- Revalidate approval expiry, source revision, user scope and target state before replay.
- A failed or stale worker lease must be fenced before another worker takes the job.
- Local root snapshots and evidence history remain available without the remote tier.

## 8. Acceptance matrix

- Single-host startup, upgrade, shutdown, crash recovery and backup/restore pass on declared Linux targets.
- Memory/CPU ceilings are measured, not asserted from nominal device specifications.
- Remote data transfer is denied without exact approval; expired and replayed approval are rejected.
- Worker kill/cancel and lease fencing prevent late side effects.
- A worker with the wrong model digest, ABI or repository revision is rejected.
- Network segmentation tests deny inbound access to data stores and internal metadata services.
- No secret appears in logs, event payloads, prompts or artifacts.
- Offline mode completes local tasks without hidden remote fallback.
- Every cloud execution emits an inspectable receipt and evidence provenance.

## 9. Deferred items

Multi-region cloud, federated learning, CRDT replication of security state, homomorphic inference, automated self-provisioning, public APIs and production deployment are explicitly out of scope until the single-host and one-worker acceptance gates pass.
