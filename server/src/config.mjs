import { isIP } from "node:net";

const DEFAULTS = Object.freeze({
  host: "127.0.0.1",
  port: 3000,
  nodeEnv: "development"
});

function parsePort(value) {
  if (value === undefined || value === "") return DEFAULTS.port;
  if (!/^(0|[1-9]\d{0,4})$/.test(value)) {
    throw new TypeError("PORT must be an integer from 0 to 65535");
  }
  const port = Number(value);
  if (port > 65_535) throw new TypeError("PORT must be an integer from 0 to 65535");
  return port;
}

function parseHost(value) {
  if (value === undefined || value === "") return DEFAULTS.host;
  if (typeof value !== "string" || value.length > 255 || /[\s\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError("HOST must be a loopback address; public binding is disabled");
  }

  const loopback = value === "localhost" || value === "::1" ||
    (isIP(value) === 4 && value.startsWith("127."));
  if (!loopback) throw new TypeError("HOST must be a loopback address; public binding is disabled");
  return value;
}

/**
 * Load the small, explicitly allowlisted, non-secret server configuration.
 * This intentionally does not parse .env files or accept credential settings.
 */
export function loadServerConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || DEFAULTS.nodeEnv;
  if (!new Set(["development", "test", "production"]).has(nodeEnv)) {
    throw new TypeError("NODE_ENV must be development, test, or production");
  }

  return Object.freeze({
    host: parseHost(env.HOST),
    port: parsePort(env.PORT),
    nodeEnv
  });
}
