import { verifyWebhookSecret } from "../security/webhook-secret.mjs";
import { validateTelegramUpdate } from "../contracts/telegram-update.mjs";

/**
 * Framework-neutral webhook handler.
 * inbox.claim must atomically create a durable PENDING record keyed by provider + event ID.
 * inbox.complete/fail must persist the terminal/retry state. A DB unique constraint is required.
 */
export function createTelegramWebhookHandler({ secret, inbox, dispatch, maxBodyBytes = 1_048_576 }) {
  if (!inbox || !["claim", "complete", "fail"].every(key => typeof inbox[key] === "function")) {
    throw new TypeError("A durable inbox with atomic claim, complete and fail methods is required");
  }
  if (typeof dispatch !== "function") throw new TypeError("A dispatch function is required");
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) throw new TypeError("maxBodyBytes must be a positive safe integer");

  return async function handleWebhook({ headers = {}, rawBody }) {
    const suppliedSecret = Object.entries(headers ?? {})
      .find(([name]) => name.toLowerCase() === "x-telegram-bot-api-secret-token")?.[1];
    if (!verifyWebhookSecret(suppliedSecret, secret)) return { status: 401, body: { ok: false, error: "WEBHOOK_UNAUTHORIZED" } };

    const bytes = Buffer.isBuffer(rawBody) ? rawBody :
      rawBody instanceof Uint8Array ? Buffer.from(rawBody) :
      Buffer.from(typeof rawBody === "string" ? rawBody : "", "utf8");
    if (bytes.length === 0 || bytes.length > maxBodyBytes) {
      return { status: 413, body: { ok: false, error: "WEBHOOK_BODY_SIZE_INVALID" } };
    }

    let update;
    try { update = JSON.parse(bytes.toString("utf8")); }
    catch { return { status: 400, body: { ok: false, error: "WEBHOOK_JSON_INVALID" } }; }

    const validation = validateTelegramUpdate(update);
    if (!validation.ok) return { status: 400, body: { ok: false, error: validation.error } };

    const event = { provider: "telegram", eventId: String(validation.updateId), payload: update };
    let claimed;
    try { claimed = await inbox.claim(event); }
    catch { return { status: 503, body: { ok: false, error: "WEBHOOK_INBOX_UNAVAILABLE" } }; }
    if (!claimed) return { status: 200, body: { ok: true, duplicate: true } };

    try {
      await dispatch({ update, eventId: event.eventId, eventType: validation.eventType });
      await inbox.complete({ provider: "telegram", eventId: event.eventId });
      return { status: 200, body: { ok: true, duplicate: false } };
    } catch {
      try {
        await inbox.fail({ provider: "telegram", eventId: event.eventId, retryable: true });
      } catch {
        return { status: 503, body: { ok: false, error: "WEBHOOK_RECOVERY_STATE_UNAVAILABLE" } };
      }
      return { status: 503, body: { ok: false, error: "WEBHOOK_DISPATCH_FAILED" } };
    }
  };
}
