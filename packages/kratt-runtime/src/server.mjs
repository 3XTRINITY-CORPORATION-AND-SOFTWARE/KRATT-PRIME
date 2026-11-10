import { createServer } from "node:http";
import { KrattRuntimeError } from "./errors.mjs";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

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

function publicCard(card) {
  return Object.freeze({ schemaVersion: card.schemaVersion, cardId: card.cardId, rootId: card.rootId, branchId: card.branchId,
    occurredAt: card.evidence.occurredAt, eventType: card.evidence.eventType, subject: card.evidence.subject,
    decision: card.evidence.decision, sourceRef: card.evidence.sourceRef, artifactDigest: card.evidence.artifactDigest });
}

function queryInteger(url, key, fallback, maximum) {
  const values = url.searchParams.getAll(key);
  if (values.length > 1) return null;
  const value = values[0] ?? String(fallback);
  if (!/^(?:0|[1-9]\d{0,8})$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export async function handleOperatorRequest(request, { readiness, logger, evidenceRepository } = {}) {
  let url;
  try { url = new URL(request.url, "http://127.0.0.1"); }
  catch { return { status: 400, body: { error: "REQUEST_INVALID" } }; }

  if (request.method === "GET" && url.pathname === "/health/live") return handleHealthRequest(request, { readiness: () => ({ ready: true }), logger });
  if (request.method === "GET" && url.pathname === "/health/ready") {
    let state;
    try { state = await readiness?.() ?? { ready: true, checks: {} }; }
    catch { state = { ready: false, checks: { evidenceJournal: "unavailable" } }; }
    return handleHealthRequest({ method: "GET", url: "/health/ready" }, { readiness: () => state, logger });
  }

  const knownReadRoute = url.pathname === "/evidence" || url.pathname === "/evidence/verify";
  const knownHealthRoute = url.pathname === "/health/live" || url.pathname === "/health/ready";
  if (request.method !== "GET") return { status: knownReadRoute || knownHealthRoute ? 405 : 404,
    body: { error: knownReadRoute || knownHealthRoute ? "METHOD_NOT_ALLOWED" : "NOT_FOUND" },
    headers: knownReadRoute || knownHealthRoute ? { allow: "GET" } : {} };
  if (!knownReadRoute) return { status: 404, body: { error: "NOT_FOUND" } };
  if (!evidenceRepository) return { status: 503, body: { error: "EVIDENCE_STORE_UNAVAILABLE" } };

  if (url.pathname === "/evidence/verify") {
    if ([...url.searchParams.keys()].length) return { status: 400, body: { error: "QUERY_INVALID" } };
    try {
      const result = await evidenceRepository.verify();
      const body = { ok: result.ok === true, schemaVersion: result.schemaVersion, eventCount: result.eventCount,
        evidenceHeadHash: result.evidenceHeadHash, journalEntries: result.journalEntries,
        journalHeadHash: result.journalHeadHash, encrypted: result.encrypted === true,
        remoteSync: result.remoteSync === true, scope: result.scope };
      return { status: result.ok === true ? 200 : 503, body };
    } catch {
      logger?.error("evidence verification failed", { code: "EVIDENCE_VERIFICATION_FAILED" });
      return { status: 503, body: { ok: false, error: "EVIDENCE_VERIFICATION_FAILED" } };
    }
  }

  if ([...url.searchParams.keys()].some(key => !["after", "limit"].includes(key))) return { status: 400, body: { error: "QUERY_INVALID" } };
  const afterSequence = queryInteger(url, "after", 0, Number.MAX_SAFE_INTEGER);
  const limit = queryInteger(url, "limit", 50, 100);
  if (afterSequence === null || limit === null || limit < 1) return { status: 400, body: { error: "QUERY_INVALID" } };
  try {
    const result = await evidenceRepository.list({ afterSequence, limit });
    if (result?.ok !== true) return { status: 503, body: { error: "EVIDENCE_READ_FAILED" } };
    return { status: 200, body: { ok: true, count: result.count, afterSequence, limit,
      cards: result.cards.map(publicCard) } };
  } catch {
    logger?.error("evidence read failed", { code: "EVIDENCE_READ_FAILED" });
    return { status: 503, body: { error: "EVIDENCE_READ_FAILED" } };
  }
}

export function createRuntimeServer({ config, logger, readiness, evidenceRepository } = {}) {
  if (!config || !LOOPBACK.has(config.host)) throw new TypeError("LOOPBACK_BIND_REQUIRED");
  const getReadiness = readiness ?? (async () => {
    if (!evidenceRepository) return { ready: true, checks: { evidenceJournal: "unavailable" } };
    try {
      const result = await evidenceRepository.verify();
      return { ready: result.ok === true, checks: { evidenceJournal: result.ok === true ? "ok" : "unavailable" } };
    } catch { return { ready: false, checks: { evidenceJournal: "unavailable" } }; }
  });
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("x-frame-options", "DENY");
    if (request.method !== "GET") request.resume();
    void handleOperatorRequest(request, { readiness: getReadiness, logger, evidenceRepository }).then(result => {
      for (const [key, value] of Object.entries(result.headers ?? {})) response.setHeader(key, value);
      response.writeHead(result.status).end(JSON.stringify(result.body));
    }).catch(() => {
      logger?.error("operator request failed", { code: "OPERATOR_REQUEST_FAILED" });
      if (!response.headersSent) response.writeHead(500);
      response.end(JSON.stringify({ error: "OPERATOR_REQUEST_FAILED" }));
    });
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 6_000;
  server.keepAliveTimeout = 2_000;
  server.maxHeadersCount = 32;
  server.maxRequestsPerSocket = 100;

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

