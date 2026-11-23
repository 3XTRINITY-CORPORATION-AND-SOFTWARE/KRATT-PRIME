# Worker and Pico-Cloud proposal boundary (Stage 7)

This increment adds a **proposal and audit boundary**, not a worker runtime. No request leaves the process, no worker is launched, and no Pico-Cloud call is made. Both proposal output and audit metadata explicitly report `dispatch: false` and `executionStarted: false`.

## Admission inputs

`createWorkerProposal` accepts exact versioned task, worker-profile and trusted-context records. It rejects accessors and unknown fields. A task is eligible only when its deadline, declared cost and duration fit the worker and trusted context; its requested capabilities appear in the intersection of principal, agent, task and worker scopes; and the worker supports the target and data class. The global kill switch blocks all proposals.

A remote proposal is additionally blocked for `RESTRICTED` data and otherwise requires two separate proof objects: exact data-transfer consent and exact worker approval. Both bind actor, canonical task digest, worker, target and data class, have bounded validity, and must pass injected server-owned verification callbacks. Signature-shaped strings alone are not cryptographic proof. The caller must wire verifiers to a trusted key and revocation service before relying on these results.

Even a fully admitted remote request only becomes `PROPOSED`; approval does not turn on dispatch. `proposePicoCloudRoute` similarly ignores legacy caller-supplied approval booleans and keeps remote routing blocked.

## Audit and privacy

`recordWorkerProposal` writes a deterministic ECK event through the supplied repository. It stores identifiers, decision, digest and bounded policy metadata; it does not store input content, signatures, consent bodies or approval bodies. The durable repository provides idempotent retries. Audit failures are returned as failures and must not be treated as successful admission.

## Not implemented / required before dispatch

- Durable reservation/uniqueness for idempotency keys, lease ownership and fencing tokens.
- Trusted server-side consent and approval issuance, key rotation/revocation, replay defense and signature format.
- A real cancellation path integrated with any running worker and a kill-switch check immediately before side effects.
- Worker sandboxing, resource isolation, protocol transport, deadlines enforced across process boundaries and cost accounting.
- Data-loss prevention, redaction and reviewed data-classification policy.
- Concurrency/load tests, threat-model review, operational monitoring and recovery procedures.

Do not implement dispatch until these items have a reviewed design and tests. No calibrated Bayesian inference or MCU behavior is implied by this stage.

