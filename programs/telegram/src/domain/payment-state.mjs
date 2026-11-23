/**
 * Provider-neutral payment states for the Telegram adapter boundary.
 * A Telegram update is not a paid entitlement until successful_payment is verified.
 */
const transitions = Object.freeze({
  CREATED: new Set(["PENDING_PROVIDER", "CANCELLED"]),
  PENDING_PROVIDER: new Set(["PAID", "FAILED", "CANCELLED"]),
  PAID: new Set(["REFUND_PENDING"]),
  REFUND_PENDING: new Set(["REFUNDED", "PAID"]),
  FAILED: new Set(),
  CANCELLED: new Set(),
  REFUNDED: new Set()
});

export function canTransitionPayment(from, to) {
  return transitions[from]?.has(to) ?? false;
}

export function transitionPayment(current, next) {
  if (!canTransitionPayment(current, next)) {
    return { ok: false, error: "invalid_payment_transition" };
  }
  return { ok: true, state: next };
}
