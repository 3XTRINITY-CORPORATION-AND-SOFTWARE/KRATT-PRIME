/**
 * Minimal Telegram Bot API client.
 * Never logs token-bearing URLs or response bodies; no automatic retries for POST calls.
 */
export function createTelegramBotApi({ token, fetchImpl = globalThis.fetch, timeoutMs = 8_000 }) {
  if (typeof token !== "string" || token.length < 20) throw new TypeError("A runtime Telegram bot token is required");
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");

  return Object.freeze({
    async call(method, payload = {}) {
      if (!/^[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(method)) throw new TypeError("Invalid Bot API method");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (!response.ok) return { ok: false, error: "TELEGRAM_HTTP_ERROR", status: response.status };
        const body = await response.json();
        if (!body || body.ok !== true) return { ok: false, error: "TELEGRAM_API_ERROR", errorCode: body?.error_code ?? null };
        return { ok: true, result: body.result };
      } catch (error) {
        return { ok: false, error: error?.name === "AbortError" ? "TELEGRAM_TIMEOUT" : "TELEGRAM_NETWORK_ERROR" };
      } finally {
        clearTimeout(timeout);
      }
    }
  });
}
