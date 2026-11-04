/**
 * Minimal structural contract for Telegram Bot API update envelopes.
 * This validates shape only; authenticity must be established at the webhook boundary.
 */

export function validateTelegramUpdate(update) {
  if (!update || typeof update !== "object" || Array.isArray(update)) {
    return { ok: false, error: "update_must_be_object" };
  }

  if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) {
    return { ok: false, error: "invalid_update_id" };
  }

  const eventKeys = [
    "message",
    "edited_message",
    "channel_post",
    "edited_channel_post",
    "business_message",
    "callback_query",
    "pre_checkout_query",
    "shipping_query",
    "poll",
    "poll_answer",
    "my_chat_member",
    "chat_member"
  ];

  const presentEvents = eventKeys.filter((key) => Object.hasOwn(update, key));
  if (presentEvents.length !== 1) {
    return { ok: false, error: "expected_exactly_one_supported_event" };
  }

  return { ok: true, updateId: update.update_id, eventType: presentEvents[0] };
}
