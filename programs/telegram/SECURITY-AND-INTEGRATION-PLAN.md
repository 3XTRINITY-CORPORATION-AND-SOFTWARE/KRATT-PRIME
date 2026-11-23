# Telegram Security & Integration Plan

## Integration boundary

Telegram is an external event provider. The program must translate updates into
KRATT PRIME canonical events without granting the Telegram adapter direct authority
over core policy, ledger mutation or agent permissions.

## Work packages

| ID | Component | Required gate |
|---|---|---|
| TG-01 | Webhook ingress | secret header verification, bounded payload, replay/idempotency |
| TG-02 | Mini App identity | server-side initData signature and auth_date validation |
| TG-03 | Bot API adapter | typed requests, timeouts, bounded retries, redacted logs |
| TG-04 | Stars payments | XTR-specific state machine, pre-checkout deadline handling, successful payment proof |
| TG-05 | Entitlements | durable activation, expiry, cancellation and refund handling |
| TG-06 | Affiliate ledger | separate accrual/liability accounting and maturity rules |
| TG-07 | KRATT adapter | policy check, scoped tool calls, evidence/provenance, idempotent audit phases |
| TG-08 | Recovery | inbox/outbox, idempotent replay, dead-letter review |

## Required acceptance tests

- Replaying the same update ID does not create a second business action.
- Incorrect or missing webhook secret is rejected before business processing.
- Mini App data with invalid signature or expired auth_date is rejected.
- Payment intent alone never activates an entitlement.
- Only a verified successful-payment event can activate a paid entitlement.
- Duplicate successful-payment delivery results in one posting and one entitlement transition.
- Refund updates are idempotent and linked to the original provider charge identifier.
- Stars XTR are not silently converted to fiat balances or affiliate payout liabilities.
- Out-of-order state transitions are rejected and recorded for review.
- Agent tool calls cannot bypass KRATT policy or self-approve restricted actions.
- A Telegram event whose update ID does not match the canonical task binding is rejected before policy evaluation.
- A denied KRATT policy decision is audited and acknowledged without executing a side effect.
- An allowed event records policy and execution intent before the idempotent executor is called.

## Implementation order

1. Preserve and inspect existing KRATT core contracts.
2. Implement webhook boundary and deterministic validation tests.
3. Implement Mini App verification against official Telegram algorithm.
4. Add durable event inbox and idempotent update processing.
5. Add Stars payment adapter and entitlement lifecycle.
6. Add affiliate accounting adapter only after ledger contract review.
7. Connect KRATT policy, Saga and evidence interfaces.
8. Add CI job scoped to Telegram package.
9. Verify tests/build; open a draft PR only after review.

## Explicit non-goals for this foundation

- No bot token, webhook URL or production endpoint.
- No real payment request or charge.
- No production database migration.
- No automatic refunds, affiliate payouts or agent-initiated financial writes.
- No deployment or change to the repository default branch.
