import { createServer } from "node:http";
import { validateTaskEnvelope } from "../../packages/kratt-core/src/contracts.mjs";

const SERVICE_NAME = "kratt-prime-server";
const API_VERSION = "v1";
const MAX_REQUEST_TARGET_LENGTH = 2_048;
const MAX_REQUEST_BODY_BYTES = 32 * 1024;
const MAX_HEADER_SIZE = 16 * 1024;
const TASK_SCHEMA = "kratt-prime/v0.1";

function sendJson(res, statusCode, payload, method = "GET", extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    ...extraHeaders
  });
  res.end(method === "HEAD" ? undefined : body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"];
    if (typeof contentType !== "string" ||
        !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
      req.resume();
      reject(Object.assign(new Error("Unsupported content type"), { code: "UNSUPPORTED_MEDIA_TYPE" }));
      return;
    }

    const contentLength = req.headers["content-length"];
    if (contentLength !== undefined &&
        (!/^(0|[1-9]\d*)$/.test(contentLength) || Number(contentLength) > MAX_REQUEST_BODY_BYTES)) {
      req.resume();
      reject(Object.assign(new Error("Request body too large"), { code: "BODY_TOO_LARGE" }));
      return;
    }

    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_REQUEST_BODY_BYTES) {
        req.resume();
        reject(Object.assign(new Error("Request body too large"), { code: "BODY_TOO_LARGE" }));
        return;
      }
      chunks.push(chunk);
    });
    req.once("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Malformed JSON"), { code: "INVALID_JSON" }));
      }
    });
    req.once("error", () => reject(Object.assign(new Error("Request failed"), { code: "INVALID_JSON" })));
    req.once("aborted", () => reject(Object.assign(new Error("Request aborted"), { code: "INVALID_JSON" })));
  });
}

function auditStatus(auditLedger) {
  if (!auditLedger || typeof auditLedger.verify !== "function") {
    return { status: 503, body: { ok: false, error: "AUDIT_UNAVAILABLE" } };
  }

  try {
    const verification = auditLedger.verify();
    const headSequence = Number.isSafeInteger(auditLedger.size) && auditLedger.size >= 0
      ? auditLedger.size
      : null;
    if (!verification || verification.ok !== true) {
      return {
        status: 503,
        body: { ok: false, audit: { availability: "available", integrity: "failed", headSequence } }
      };
    }
    return {
      status: 200,
      body: { ok: true, audit: { availability: "available", integrity: "verified", headSequence } }
    };
  } catch {
    return { status: 503, body: { ok: false, error: "AUDIT_UNAVAILABLE" } };
  }
}

async function handleRequest(req, res, { auditLedger }) {
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

    const readOnlyMethods = new Set(["GET", "HEAD"]);
    const validationMethod = req.method === "POST" && url.pathname === "/v1/tasks/validate";
    if (!readOnlyMethods.has(req.method) && !validationMethod) {
      res.setHeader("Allow", url.pathname === "/v1/tasks/validate" ? "GET, HEAD, POST" : "GET, HEAD");
      sendJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" }, req.method);
      return;
    }

    if (url.pathname === "/health" || url.pathname === "/health/live") {
      sendJson(res, 200, {
        ok: true,
        service: SERVICE_NAME,
        health: { liveness: "healthy" }
      }, req.method);
      return;
    }

    if (url.pathname === "/health/ready") {
      sendJson(res, 200, {
        ok: true,
        service: SERVICE_NAME,
        health: { readiness: "ready", executionEnabled: false }
      }, req.method);
      return;
    }

    if (url.pathname === "/v1/status") {
      sendJson(res, 200, {
        ok: true,
        apiVersion: API_VERSION,
        service: SERVICE_NAME,
        mode: "foundation",
        capabilities: Object.freeze({
          taskValidation: true,
          taskExecution: false,
          externalWrites: false,
          auditReadiness: true
        })
      }, req.method);
      return;
    }

    if (url.pathname === "/v1/audit/status") {
      const result = auditStatus(auditLedger);
      sendJson(res, result.status, result.body, req.method);
      return;
    }

    if (url.pathname === "/v1/tasks/validate" && validationMethod) {
      let input;
      try {
        input = await readJsonBody(req);
      } catch (error) {
        const code = error?.code;
        const status = code === "UNSUPPORTED_MEDIA_TYPE" ? 415 :
          code === "BODY_TOO_LARGE" ? 413 : 400;
        const publicError = code === "UNSUPPORTED_MEDIA_TYPE" ? "UNSUPPORTED_MEDIA_TYPE" :
          code === "BODY_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_JSON";
        sendJson(res, status, { ok: false, error: publicError }, req.method);
        return;
      }

      const result = validateTaskEnvelope(input);
      if (!result.ok) {
        sendJson(res, 400, {
          ok: false,
          valid: false,
          schemaVersion: TASK_SCHEMA,
          errors: result.errors
        }, req.method);
        return;
      }
      sendJson(res, 200, {
        ok: true,
        valid: true,
        schemaVersion: TASK_SCHEMA,
        admitted: false,
        executionStarted: false
      }, req.method);
      return;
    }

    if (url.pathname === "/") {
      sendJson(res, 200, {
        ok: true,
        service: SERVICE_NAME,
        apiVersion: API_VERSION,
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

/** Create a bounded, loopback-only foundation; task validation never admits or executes work. */
export function createServerApp({ auditLedger } = {}) {
  return createServer({
    maxHeaderSize: MAX_HEADER_SIZE,
    requestTimeout: 10_000,
    headersTimeout: 5_000,
    keepAliveTimeout: 5_000
  }, (req, res) => handleRequest(req, res, { auditLedger }));
}
