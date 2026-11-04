# KRATT PRIME — Telegram Program

Status: **foundation / implementation not yet connected to Telegram runtime**

This directory is the independently versioned Telegram program inside KRATT PRIME.
Its branch-level primary development line is `telegram-main`; the repository default
branch remains `main` and is not modified by work in this program.

## Scope

- Telegram Bot API gateway and webhook ingress
- webhook secret verification and replay/idempotency protection
- Telegram Mini App authentication validation
- Telegram Stars payment event adapter
- subscription and entitlement lifecycle
- affiliate accounting adapter (separate from native Telegram subscriptions)
- KRATT PRIME policy, agent, Saga, memory and evidence adapters

## Safety invariants

1. Never commit bot tokens, webhook secrets, signing keys, payment credentials or user data.
2. Verify Telegram webhook `X-Telegram-Bot-Api-Secret-Token` before parsing business events.
3. Validate Mini App `initData` on the server; never trust client-provided identity fields.
4. A payment is not successful until a verified `successful_payment` event is processed.
5. Process updates idempotently; persist provider event identifiers and durable state transitions.
6. Agents may inspect, classify and prepare actions; refunds, financial postings and privilege changes require policy authorization and explicit approval.
7. Keep Telegram Stars (XTR), fiat balances, affiliate accruals and payout liabilities in separate accounting dimensions.
8. No production webhook, payment flow, bot token or deployment is enabled by this scaffold.

## Planned layout

```
programs/telegram/
  README.md
  package.json
  src/
    index.mjs
    contracts/
      telegram-update.mjs
    security/
      webhook-secret.mjs
      mini-app-init-data.mjs
    adapters/
      bot-api.mjs
      stars-payments.mjs
    domain/
      payment-state.mjs
      entitlement-state.mjs
  test/
    contracts.test.mjs
```

Only files explicitly marked as implemented should be treated as runtime functionality.
The initial commit establishes package boundaries and validation contracts; it does not
claim a live Telegram connection.
