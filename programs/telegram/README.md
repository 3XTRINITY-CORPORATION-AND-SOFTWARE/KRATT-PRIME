# KRATT PRIME — Telegram Program

Status: **implemented adapter foundation; production integration not enabled**

This is the independently developed Telegram program inside KRATT PRIME. Its branch-level
primary line is `telegram-main`; repository default branch `main` remains untouched.

## Implemented

- Telegram update envelope validation.
- Webhook secret verification before JSON parsing.
- Framework-neutral webhook handler with durable inbox claim/complete/fail contract.
- KRATT policy-gated dispatcher that binds Telegram event IDs to canonical task envelopes, requires trusted policy decisions, and records decision/execution phases through an idempotent audit adapter.
- PostgreSQL inbox adapter with unique event identity, retry backoff, stale-processing lease recovery and dead-letter state.
- Telegram Mini App `initData` HMAC-SHA256 validation, auth-date freshness, duplicate parameter rejection and timing-safe hash comparison.
- Minimal Bot API client with runtime token injection, timeout and redacted errors.
- Telegram Stars successful-payment validation (XTR, amount, invoice payload and charge ID).
- Conservative payment state transitions.
- Node.js test suite and branch-scoped GitHub Actions workflow.

## Package

Node.js >=22. Run tests from repository root:

```bash
node --test programs/telegram/test/*.test.mjs
```

Run the PostgreSQL migration before constructing `createPostgresTelegramInbox(pool)`:

`migrations/001_telegram_inbox.sql`

## Security invariants

1. Never commit bot tokens, webhook secrets, signing keys, payment credentials or user data.
2. Verify `X-Telegram-Bot-Api-Secret-Token` before parsing webhook business events.
3. Validate raw Mini App `initData` on the server; never trust `initDataUnsafe`.
4. Payment intent alone never activates an entitlement.
5. Only a verified `successful_payment` event matching XTR amount and invoice payload is eligible for entitlement activation.
6. Use durable unique provider/event IDs; do not use process memory as the production idempotency store.
7. Keep XTR, fiat balances, affiliate accruals and payout liabilities separate.
8. Restricted financial and privilege actions must pass KRATT policy and explicit approval.
9. No production webhook, payment, refund or deployment is enabled by this package.

## Not yet production-complete

- PostgreSQL integration tests against a real database and operational monitoring.
- Transactional outbox and worker for downstream KRATT delivery.
- Mini App session issuance/rotation after initData validation.
- Bot API rate limiting and method-aware retry policy.
- Stars invoice creation, pre-checkout handler, refund flow and durable ledger posting.
- KRATT Policy/Saga/evidence adapters and end-to-end acceptance tests.
