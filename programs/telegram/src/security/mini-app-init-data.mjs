import { createHmac, timingSafeEqual } from "node:crypto";

function safeHexEqual(left, right) {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Validate raw Telegram.WebApp.initData using the bot-token HMAC scheme.
 * The raw bot token must be provided by a secret manager/environment at runtime.
 */
export function validateMiniAppInitData(rawInitData, botToken, options = {}) {
  const {
    nowSeconds = Math.floor(Date.now() / 1000),
    maxAgeSeconds = 300,
    maxFutureSkewSeconds = 30,
    maxLength = 16_384
  } = options;

  if (typeof rawInitData !== "string" || rawInitData.length === 0 || rawInitData.length > maxLength) {
    return { ok: false, error: "INIT_DATA_INVALID_SIZE" };
  }
  if (typeof botToken !== "string" || botToken.length < 20) {
    return { ok: false, error: "BOT_TOKEN_NOT_CONFIGURED" };
  }

  let params;
  try {
    params = new URLSearchParams(rawInitData);
  } catch {
    return { ok: false, error: "INIT_DATA_PARSE_FAILED" };
  }

  const entries = [...params.entries()];
  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length) return { ok: false, error: "INIT_DATA_DUPLICATE_KEYS" };

  const receivedHash = params.get("hash");
  if (!receivedHash || !/^[0-9a-f]{64}$/i.test(receivedHash)) {
    return { ok: false, error: "INIT_DATA_HASH_MISSING_OR_INVALID" };
  }
  const authDateRaw = params.get("auth_date");
  if (!authDateRaw || !/^\d+$/.test(authDateRaw)) return { ok: false, error: "INIT_DATA_AUTH_DATE_INVALID" };
  const authDate = Number(authDateRaw);
  if (!Number.isSafeInteger(authDate)) return { ok: false, error: "INIT_DATA_AUTH_DATE_INVALID" };
  if (authDate > nowSeconds + maxFutureSkewSeconds) return { ok: false, error: "INIT_DATA_FROM_FUTURE" };
  if (nowSeconds - authDate > maxAgeSeconds) return { ok: false, error: "INIT_DATA_EXPIRED" };

  const dataCheckString = entries
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => [key, value])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeHexEqual(calculatedHash, receivedHash)) return { ok: false, error: "INIT_DATA_SIGNATURE_INVALID" };

  const result = Object.fromEntries(entries.filter(([key]) => key !== "hash"));
  if (result.user) {
    try {
      result.user = JSON.parse(result.user);
    } catch {
      return { ok: false, error: "INIT_DATA_USER_INVALID_JSON" };
    }
    if (!result.user || typeof result.user !== "object" || !Number.isSafeInteger(result.user.id)) {
      return { ok: false, error: "INIT_DATA_USER_INVALID" };
    }
  }
  return { ok: true, authDate, data: result };
}
