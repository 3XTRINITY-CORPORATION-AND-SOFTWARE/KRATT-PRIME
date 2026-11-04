import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { validateMiniAppInitData } from "../src/security/mini-app-init-data.mjs";
import { createTelegramWebhookHandler } from "../src/adapters/webhook-handler.mjs";
import { verifyStarsSuccessfulPayment, activatePaidEntitlement } from "../src/domain/telegram-payment.mjs";

function signedInitData(token, fields) {
  const entries = Object.entries(fields);
  const check = entries.map(([k,v]) => `${k}=${v}`).sort().join("\n");
  const key = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", key).update(check).digest("hex");
  return new URLSearchParams([...entries, ["hash", hash]]).toString();
}

test("validates Telegram Mini App initData HMAC and freshness", () => {
  const token = "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
  const now = 1_800_000_000;
  const raw = signedInitData(token, {
    auth_date: String(now - 10),
    query_id: "query-123",
    user: JSON.stringify({ id: 123456, first_name: "Test" })
  });
  const result = validateMiniAppInitData(raw, token, { nowSeconds: now });
  assert.equal(result.ok, true);
  assert.equal(result.data.user.id, 123456);
  assert.equal(validateMiniAppInitData(raw, token, { nowSeconds: now + 1000 }).error, "INIT_DATA_EXPIRED");
});

test("rejects duplicate Mini App initData keys and tampering", () => {
  const token = "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
  const now = 1_800_000_000;
  const raw = signedInitData(token, { auth_date: String(now), user: JSON.stringify({ id: 1 }) });
  assert.equal(validateMiniAppInitData(raw + "&auth_date=" + now, token, { nowSeconds: now }).error, "INIT_DATA_DUPLICATE_KEYS");
  assert.equal(validateMiniAppInitData(raw.replace("user=", "user=x"), token, { nowSeconds: now }).ok, false);
});

test("webhook authenticates before parsing and atomically deduplicates", async () => {
  const seen = new Set();
  const completed = new Set();
  const failed = [];
  const dispatched = [];
  const handler = createTelegramWebhookHandler({
    secret: "a-webhook-secret-value",
    inbox: {
      claim: async ({ eventId }) => { if (seen.has(eventId)) return false; seen.add(eventId); return true; },
      complete: async ({ eventId }) => completed.add(eventId),
      fail: async entry => failed.push(entry)
    },
    dispatch: async event => dispatched.push(event)
  });
  const rawBody = JSON.stringify({ update_id: 77, message: { message_id: 1 } });
  assert.equal((await handler({ headers: {}, rawBody })).status, 401);
  assert.equal((await handler({ headers: { "x-telegram-bot-api-secret-token": "a-webhook-secret-value" }, rawBody })).status, 200);
  const duplicate = await handler({ headers: { "x-telegram-bot-api-secret-token": "a-webhook-secret-value" }, rawBody });
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(dispatched.length, 1);
  assert.equal(completed.has("77"), true);
});

test("marks a claimed webhook event retryable when dispatch fails", async () => {
  const failed = [];
  const handler = createTelegramWebhookHandler({
    secret: "a-webhook-secret-value",
    inbox: {
      claim: async () => true,
      complete: async () => {},
      fail: async entry => failed.push(entry)
    },
    dispatch: async () => { throw new Error("downstream unavailable"); }
  });
  const response = await handler({
    headers: { "x-telegram-bot-api-secret-token": "a-webhook-secret-value" },
    rawBody: JSON.stringify({ update_id: 78, message: { message_id: 2 } })
  });
  assert.equal(response.status, 503);
  assert.deepEqual(failed, [{ provider: "telegram", eventId: "78", retryable: true }]);
});

test("validates Stars payment amount, currency and charge identity", () => {
  const payment = {
    currency: "XTR", total_amount: 250, invoice_payload: "order-1",
    telegram_payment_charge_id: "charge-telegram-1", provider_payment_charge_id: ""
  };
  const expected = { currency: "XTR", totalAmount: 250, invoicePayload: "order-1" };
  assert.equal(verifyStarsSuccessfulPayment({ payment, expected }).ok, true);
  assert.equal(verifyStarsSuccessfulPayment({ payment: { ...payment, total_amount: 200 }, expected }).error, "PAYMENT_AMOUNT_MISMATCH");
  assert.equal(activatePaidEntitlement({ paymentState: "PENDING_PROVIDER", payment, expected }).entitlementEligible, true);
  assert.equal(activatePaidEntitlement({ paymentState: "CREATED", payment, expected }).ok, false);
});
