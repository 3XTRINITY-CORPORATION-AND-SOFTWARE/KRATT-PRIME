import { ConfigurationError } from "./errors.mjs";

const PORT = /^(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/;
const LEVELS = new Set(["debug", "info", "warn", "error"]);

export function loadRuntimeConfig(env = process.env) {
  const host = env.KRATT_HOST ?? "127.0.0.1";
  const portText = env.KRATT_PORT ?? "4317";
  const logLevel = env.KRATT_LOG_LEVEL ?? "info";
  const mode = env.KRATT_RUNTIME_MODE ?? "local";
  if (host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    throw new ConfigurationError("KRATT_HOST must be loopback; remote binding is not enabled");
  }
  if (!PORT.test(portText)) throw new ConfigurationError("KRATT_PORT must be an integer from 1 to 65535");
  if (!LEVELS.has(logLevel)) throw new ConfigurationError("KRATT_LOG_LEVEL is unsupported");
  if (mode !== "local") throw new ConfigurationError("Only local runtime mode is currently supported");
  return Object.freeze({ host, port: Number(portText), logLevel, mode });
}
