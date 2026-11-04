import { timingSafeEqual } from "node:crypto";

/**
 * Verify Telegram's configured webhook secret header.
 * The expected secret must be supplied from runtime secret storage, never source code.
 */
export function verifyWebhookSecret(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string") return false;
  if (received.length === 0 || expected.length === 0) return false;

  const receivedBuffer = Buffer.from(received, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (receivedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
