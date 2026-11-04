import { transitionPayment } from "./payment-state.mjs";

/**
 * Validate Telegram Stars successful_payment against the expected XTR invoice.
 * The caller must have already verified the update authenticity and claimed its update ID.
 */
export function verifyStarsSuccessfulPayment({ payment, expected }) {
  if (!payment || !expected) return { ok: false, error: "PAYMENT_INPUT_MISSING" };
  if (payment.currency !== "XTR" || expected.currency !== "XTR") return { ok: false, error: "PAYMENT_CURRENCY_MISMATCH" };
  if (!Number.isSafeInteger(payment.total_amount) || payment.total_amount <= 0 ||
      !Number.isSafeInteger(expected.totalAmount) || expected.totalAmount <= 0 ||
      payment.total_amount !== expected.totalAmount) return { ok: false, error: "PAYMENT_AMOUNT_MISMATCH" };
  if (typeof payment.telegram_payment_charge_id !== "string" || payment.telegram_payment_charge_id.length < 1) {
    return { ok: false, error: "PAYMENT_CHARGE_ID_MISSING" };
  }
  if (typeof payment.provider_payment_charge_id !== "string" && payment.provider_payment_charge_id !== "") {
    return { ok: false, error: "PAYMENT_PROVIDER_CHARGE_ID_INVALID" };
  }
  if (typeof payment.invoice_payload !== "string" || payment.invoice_payload !== expected.invoicePayload) {
    return { ok: false, error: "PAYMENT_INVOICE_PAYLOAD_MISMATCH" };
  }
  return {
    ok: true,
    value: Object.freeze({
      currency: "XTR",
      totalAmount: payment.total_amount,
      telegramPaymentChargeId: payment.telegram_payment_charge_id,
      providerPaymentChargeId: payment.provider_payment_charge_id || null,
      invoicePayload: payment.invoice_payload
    })
  };
}

export function activatePaidEntitlement({ paymentState, payment, expected }) {
  const verified = verifyStarsSuccessfulPayment({ payment, expected });
  if (!verified.ok) return verified;
  const transition = transitionPayment(paymentState, "PAID");
  if (!transition.ok) return transition;
  return { ok: true, payment: verified.value, paymentState: transition.state, entitlementEligible: true };
}
