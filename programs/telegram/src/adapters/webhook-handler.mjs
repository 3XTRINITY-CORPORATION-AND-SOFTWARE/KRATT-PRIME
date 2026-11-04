import { verifyWebhookSecret } from "../security/webhook-secret.mjs";
import { validateTelegramUpdate } from "../contracts/telegram-update.mjs";

/**
 * Framework-neutral webhook handler. The injected inbox must atomically claim update IDs
 * (e.g. PostgreSQL INSERT ... ON CONFLICT DO NOTHING) before dispatch.
 */
export function createTelegramWebhookHandler({ secret, inbox, dispatch, maxBodyBytes = 1_048_576 }) {
  if (!inbox || typeof inbox.claim !== "function") throw new TypeError("An atomic inbox.claim adapter is required");
  if (typeof dispatch !== "function") throw new TypeError("A dispatch function is required");

  return async function handleWebhook({ headers = {}, rawBody }) {
    const suppliedSecret = headers["x-telegram-bot-api-secret-token"] ?? headers["X-Telegram-Bot-Api-Secret-Token"];
    if (!verifyWebhookSecret(suppliedSecret, secret)) return { status: 401, body: { ok: false, error: "WEBHOOK_UNAUTHORIZED" } };

    const bytes = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ""), "utf8");
    if (bytes.length === 0 || bytes.length > maxBodyBytes) {
      return { status: 413, body: { ok: false, error: "WEBHOOK_BODY_SIZE_INVALID" } };
    }

    let update;
    try { update = JSON.parse(bytes.toString("utf8")); }
    catch { return { status: 400, body: { ok: false, error: "WEBHOOK_JSON_INVALID" } }; }

    const validation = validateTelegramUpdate(update);
    if (!validation.ok) return { status: 400, body: { ok: false, error: validation.error } };

    let claimed;
    try { claimed = await inbox.claim({ provider: "telegram", eventId: String(validation.updateId), payload: update }); }
    catch { return { status: 503, body: { ok: false, error: "WEBHOOK_INBOX_UNAVAILABLE" } }; }
    if (!claimed) return { status: 200, body: { ok: true, duplicate: true } };

    try {
      await dispatch({ update, eventId: String(validation.updateId), eventType: validation.eventType });
      return { status: 200, body: { ok: true, duplicate: false } };
    } catch {
      // The durable inbox owns retry/recovery; acknowledge only after successful durable claim.
      // A production adapter must persist processing state and schedule recovery on failure.
      return { status: 503, body: { ok: false, error: "WEBHOOK_DISPATCH_FAILED" } };
    }
  };
}
