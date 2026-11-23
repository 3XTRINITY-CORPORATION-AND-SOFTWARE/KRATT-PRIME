const PRIORITY = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const SECRET_KEY = /(secret|token|password|authorization|cookie|email|private.?key)/i;
const SECRET_VALUE = /(gh[pousr]_[A-Za-z0-9]{12,}|xai-[A-Za-z0-9]{12,}|sk-[A-Za-z0-9]{12,}|Bearer\s+\S+|[\w.+-]+@[\w-]+\.[\w.-]+)/gi;
const redact = value => value.replace(SECRET_VALUE, "[REDACTED]").slice(0, 256);

function safeFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  return Object.fromEntries(Object.entries(fields)
    .filter(([key, value]) => !SECRET_KEY.test(key) &&
      (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null))
    .map(([key, value]) => [key, typeof value === "string" ? redact(value) : value])
    .slice(0, 32));
}

export function createLogger({ level = "info", sink = line => process.stdout.write(`${line}\n`) } = {}) {
  const threshold = PRIORITY[level] ?? PRIORITY.info;
  return Object.freeze(Object.fromEntries(Object.entries(PRIORITY).map(([name, priority]) => [name,
    (message, fields = {}) => {
      if (priority < threshold) return;
      sink(JSON.stringify({ timestamp: new Date().toISOString(), level: name,
        message: redact(String(message)), ...safeFields(fields) }));
    }] )));
}
