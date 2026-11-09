import { createServer } from "node:http";
import { KrattRuntimeError } from "./errors.mjs";

export function handleHealthRequest(request, { readiness = () => ({ ready: true, checks: {} }), logger } = {}) {
  if (request.method !== "GET" || !["/health/live", "/health/ready"].includes(request.url)) {
    return { status: 404, body: { error: "NOT_FOUND" } };
  }
  if (request.url === "/health/live") return { status: 200, body: { status: "live" } };
  let state;
  try { state = readiness(); }
  catch {
    logger?.error("readiness check failed", { code: "READINESS_CHECK_FAILED" });
    state = { ready: false, checks: {} };
  }
  const checks = Object.fromEntries(Object.entries(state?.checks ?? {}).slice(0, 32).map(([key, value]) => [
    /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key) ? key : "invalid_check",
    typeof value === "boolean" ? value : ["ok", "unavailable", "degraded", "blocked"].includes(value) ? value : "unknown"
  ]));
  return { status: state?.ready === true ? 200 : 503,
    body: { status: state?.ready === true ? "ready" : "not_ready", checks } };
}

export function createRuntimeServer({ config, logger, readiness = () => ({ ready: true, checks: {} }) }) {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "no-referrer");
    const result = handleHealthRequest(request, { readiness, logger });
    response.writeHead(result.status).end(JSON.stringify(result.body));
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 6_000;
  server.keepAliveTimeout = 2_000;
  server.maxHeadersCount = 32;

  return Object.freeze({
    server,
    listen: () => new Promise((resolve, reject) => {
      const onError = error => { server.off("listening", onListening); reject(new KrattRuntimeError("SERVER_LISTEN_FAILED", "Runtime server failed to listen", { cause: error })); };
      const onListening = () => { server.off("error", onError); resolve(server.address()); };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(config.port, config.host);
    }),
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  });
}
