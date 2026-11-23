import test from "node:test";
import assert from "node:assert/strict";
import { validateTelegramUpdate } from "../src/contracts/telegram-update.mjs";
import { verifyWebhookSecret } from "../src/security/webhook-secret.mjs";
import { canTransitionPayment, transitionPayment } from "../src/domain/payment-state.mjs";

test("accepts a structurally valid Telegram message update", () => {
  assert.deepEqual(
    validateTelegramUpdate({ update_id: 42, message: { message_id: 7 } }),
    { ok: true, updateId: 42, eventType: "message" }
  );
});

test("rejects malformed or ambiguous update envelopes", () => {
  assert.equal(validateTelegramUpdate(null).ok, false);
  assert.equal(validateTelegramUpdate({ update_id: -1, message: {} }).ok, false);
  assert.equal(validateTelegramUpdate({ update_id: 1, message: {}, callback_query: {} }).ok, false);
});

test("compares webhook secrets and rejects absent values", () => {
  assert.equal(verifyWebhookSecret("secret", "secret"), true);
  assert.equal(verifyWebhookSecret("wrong", "secret"), false);
  assert.equal(verifyWebhookSecret(undefined, "secret"), false);
});

test("requires verified payment lifecycle transitions", () => {
  assert.equal(canTransitionPayment("PENDING_PROVIDER", "PAID"), true);
  assert.equal(canTransitionPayment("CREATED", "PAID"), false);
  assert.deepEqual(transitionPayment("CREATED", "PAID"), {
    ok: false,
    error: "invalid_payment_transition"
  });
});

test("webhook secret enforces Telegram's allowed format and length", () => {
  assert.equal(verifyWebhookSecret("secret with spaces", "secret with spaces"), false);
  assert.equal(verifyWebhookSecret("x".repeat(257), "x".repeat(257)), false);
  assert.equal(verifyWebhookSecret("valid_token-123", "valid_token-123"), true);
});

test("rejects a supported update key with a non-object payload", () => {
  assert.equal(validateTelegramUpdate({ update_id: 3, message: null }).error, "invalid_event_payload");
  assert.equal(validateTelegramUpdate({ update_id: 3, message: [] }).error, "invalid_event_payload");
});
