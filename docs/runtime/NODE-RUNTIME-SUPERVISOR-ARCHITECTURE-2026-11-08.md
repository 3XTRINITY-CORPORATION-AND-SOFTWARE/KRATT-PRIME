# KRATT PRIME — Node.js Runtime Supervisor Architecture

**Status:** Proposed engineering contract; implementation is partial until the acceptance matrix passes.
**Parent source:** `feature/hardware-aware-runtime-v0.2.0-2026-11-07`
**Scope:** Node.js host runtime, process supervision, local orchestration and adapter hosting. This does not replace the OS kernel or MCU firmware.

## 1. Why Node.js belongs in KRATT PRIME

Node.js is the portable **host control-plane runtime** for KRATT PRIME. It is useful because the existing project already uses JavaScript ES modules and Node's built-in APIs, and the current core includes policy, agent registry, Saga, memory, evidence and hardware-routing modules.

Node.js should own:
- task admission, typed request validation and orchestration;
- agent and worker lifecycle, budgets, deadlines, cancellation and retries;
- local HTTP/WebSocket APIs and event delivery;
- repository indexing and connector adapters;
- policy/evidence composition and durable-store interfaces;
- host capability collection and compute-route proposals;
- telemetry, health/readiness and graceful shutdown.

Node.js is **not**:
- the Linux/Windows/Android operating-system kernel;
- an inference runtime suitable for a tiny MCU;
- proof that a hardware accelerator is installed or working;
- a security boundary for untrusted plugins merely because they run in a Worker Thread.

The correct split is: Node.js supervises work on a capable host; native or WebAssembly/ONNX-class workers perform suitable host inference; MCU firmware uses a compact C/C++/Rust or vendor-native inference runtime; KRATT's policy layer authorizes every side effect regardless of execution backend.

## 2. Runtime topology

```text
User / UI / local API
        |
Node.js Control Plane (host process)
  |-- task admission + typed contracts
  |-- policy / approval / kill-switch gate
  |-- branch + agent scheduler
  |-- repository / plugin gateway
  |-- event journal + evidence references
        |
Worker Supervisor (separate OS processes for isolation)
  |-- CPU-bound JS / parsing workers
  |-- native inference adapter
  |-- repository indexer
  |-- sandboxed plugin adapter
        |
Compute Router (proposal only until policy accepts)
  |-- local CPU / GPU / NPU
  |-- attached MCU via explicit device adapter
  |-- optional remote Pico-Cloud worker
```

Keep the control plane small and deterministic. The data plane contains expensive or failure-prone work. The Node supervisor should never load arbitrary plugin code into the privileged control-plane process.

## 3. Node version policy

The current branch pins `.nvmrc` to Node 22 and the root manifest constrains the application to `>=22 <23`; the current CI matrix also tests Node 22. Do not silently rewrite those files as part of this architecture-only change.

As of 2026-11-08, the Node.js release schedule lists 26.x as Active LTS (EOL 2029-04-30), 24.x as Maintenance LTS (EOL 2028-04-30), and 22.x as Maintenance LTS (EOL 2027-04-30). See the official [Node.js release schedule](https://github.com/nodejs/Release) and [previous releases](https://nodejs.org/en/about/previous-releases).

**Decision:** make Node 26 the target for new KRATT host-runtime development, retain Node 22 as a temporary compatibility lane for the existing Vite/AURA root application, and test Node 24 as a migration bridge where dependencies require it. Change `.nvmrc`, `engines`, lockfiles or CI only in a separate reviewed change after all root and core packages pass the full matrix. Never use an unbounded engine range.

## 4. Runtime services and contracts

| Service | Responsibility | Boundary |
|---|---|---|
| `NodeRuntimeProfile` | Node version, OS/arch, logical CPU count and memory observations | Read-only; no host fingerprint or environment dump |
| `RuntimeSupervisor` | Start/stop workers, enforce deadlines, capture exit state | Fixed executable/argument allowlist; no shell strings |
| `TaskScheduler` | Bounded concurrency, queue, fairness and back-pressure | Durable task IDs and lease/fencing tokens |
| `ComputeRouter` | Convert hardware snapshot into a route proposal | Proposal is not execution or authorization |
| `AdapterGateway` | Typed provider operations and result normalization | Explicit scope, timeout, idempotency and side-effect class |
| `EventJournal` | Append task/agent/runtime events | Transactional durable adapter required outside tests |
| `HealthService` | Liveness, readiness, dependency state and resource pressure | No secrets or sensitive network metadata in public health output |

All cross-package payloads must be versioned, bounded, plain JSON-compatible data. Preserve the existing policy/evidence implementation as the single authority; do not clone policy rules inside Node adapters.

## 5. Worker and concurrency rules

1. Use the Node event loop for network I/O, orchestration and short bounded tasks.
2. Use Worker Threads for CPU-heavy JavaScript only when shared-process isolation is acceptable. A Worker Thread is not a sandbox.
3. Use a separate child process or OS sandbox for untrusted, native or crash-prone work. Invoke a fixed executable with an argument array and a controlled working directory; do not invoke a shell or concatenate user data into commands.
4. Bound queue length, concurrency, memory, output size, wall-clock duration and retries.
5. Propagate cancellation with `AbortSignal`; after cancellation, fence the worker before any additional side effect.
6. Use idempotency keys for retriable operations. Never automatically retry an irreversible operation without explicit compensation semantics.
7. Treat worker stdout/stderr, files and returned JSON as untrusted data; schema-validate and redact before storing.
8. Keep plugin credentials outside worker arguments, environment dumps, logs and prompts. Resolve credentials only through a server-side broker when an approved adapter actually exists.

## 6. Hardware and inference placement

- Node host profiling is read-only and descriptive; the new `node-runtime-profile.mjs` collector does not execute commands, inspect environment variables or change host settings.
- Reuse `hardware-capabilities.mjs` and `runtime-orchestrator.mjs`; do not create a second device router.
- Hardware detection, backend availability, model compatibility, route proposal, policy approval and successful execution are distinct states.
- Keep MCU inference on the MCU's native runtime. Node may package a task, receive a bounded result and manage firmware/model provenance; it should not be installed as the MCU's general runtime.
- Prefer memory-first strategies: quantized model variants, activation lifetime planning, patch/stream inference, compressed weights and on-demand reconstruction. AdderNet is an optional arithmetic backend, not a universal SRAM fix.
- Benchmark prefill, decode, embedding, vision and audio separately. Do not infer performance from a device label or theoretical TOPS.

## 7. Persistence and local-first behaviour

For a single-host MVP, use one transactional local store behind interfaces for task journal, evidence, memory and nonce/idempotency state. SQLite is an acceptable candidate only after crash recovery, atomicity, backup/restore and concurrent access tests. For multi-host execution, move authoritative coordination to a shared transactional store with leases/fencing; local SQLite is not a distributed consistency mechanism.

The event journal is append-only. Current state is a projection from events, not an independently mutated truth. Offline queues may hold permitted read or local operations, but authorization, approval expiry, evidence freshness and target state must be re-evaluated before replay.

## 8. Runtime state machine

`UNINITIALIZED → PROFILED → READY → TASK_ACCEPTED → POLICY_APPROVED → SCHEDULED → RUNNING → SUCCEEDED | FAILED | CANCELLED | BLOCKED`

Additional invariants:
- no trusted clock or trusted policy context means no privileged execution;
- `PROFILED` does not imply a backend is available;
- `SCHEDULED` does not imply a worker started;
- `RUNNING` requires an execution receipt and worker identity;
- a remote route requires a separate data-transfer approval;
- crash recovery resumes only from a durable checkpoint and re-checks authorization.

## 9. Required tests and acceptance

- Node 22/24/26 CI matrix for core packages, followed by a controlled migration of the root application.
- deterministic unit tests for profile parsing, missing metrics, invalid versions and immutable output;
- process-supervisor tests for timeout, cancellation, signal handling, crash, output truncation and restart limits;
- negative tests proving no shell interpolation, arbitrary executable, environment dump or secret leakage;
- memory-pressure tests on a small ARM host and a constrained x86 host;
- hardware route tests separating detected, available, compatible, proposed and executed states;
- idempotency, lease-expiry, fencing and crash-recovery tests;
- software bill of materials, pinned dependencies and verified build provenance before release.

## 10. Deferred, not claimed

This document and the profile collector do not provide a production scheduler, container sandbox, credential broker, remote cloud, native inference engine, MCU firmware, distributed queue, signed release pipeline or measured performance gain. These remain separate deliverables with explicit tests.
