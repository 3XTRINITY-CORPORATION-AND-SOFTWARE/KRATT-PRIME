import { createServer } from "node:http";

const SERVICE_NAME = "kratt-prime-server";
const MAX_REQUEST_TARGET_LENGTH = 2_048;
const MAX_HEADER_SIZE = 16 * 1024;

function sendJson(res, statusCode, payload, method = "GET") {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY"
  });
  res.end(method === "HEAD" ? undefined : body);
}

function handleRequest(req, res) {
  try {
    const requestTarget = req.url;
    if (typeof requestTarget !== "string" ||
        requestTarget.length > MAX_REQUEST_TARGET_LENGTH ||
        !requestTarget.startsWith("/")) {
      sendJson(res, 400, { ok: false, error: "INVALID_REQUEST_TARGET" }, req.method);
      return;
    }

    const url = new URL(requestTarget, "http://server.invalid");
    if (url.origin !== "http://server.invalid") {
      sendJson(res, 400, { ok: false, error: "INVALID_REQUEST_TARGET" }, req.method);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      sendJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" }, req.method);
      return;
    }

    if (url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: SERVICE_NAME,
        status: "healthy"
      }, req.method);
      return;
    }

    if (url.pathname === "/") {
      sendJson(res, 200, {
        ok: true,
        service: SERVICE_NAME,
        mode: "foundation"
      }, req.method);
      return;
    }

    sendJson(res, 404, { ok: false, error: "NOT_FOUND" }, req.method);
  } catch {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    sendJson(res, 500, { ok: false, error: "INTERNAL_SERVER_ERROR" }, req.method);
  }
}

/** Create a bounded, read-only HTTP foundation; this does not listen or execute tasks. */
export function createServerApp() {
  return createServer({
    maxHeaderSize: MAX_HEADER_SIZE,
    requestTimeout: 10_000,
    headersTimeout: 5_000,
    keepAliveTimeout: 5_000
  }, handleRequest);
}
