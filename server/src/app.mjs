import { createServer } from "node:http";
import { validateTaskEnvelope } from "../../packages/kratt-core/src/contracts.mjs";
import { createInMemoryStatusRegistry } from "./status-registry.mjs";
import { createInMemoryAuditAdapter } from "./audit-adapter.mjs";
import { createPolicyGate } from "./policy-gate.mjs";

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

function requestError(code) {
  return Object.assign(new Error(code), { code });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"];
    if (typeof contentType !== "string" ||
        !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
      req.resume();
      reject(requestError("UNSUPPORTED_MEDIA_TYPE"));
      return;
    }

    const contentLength = req.headers["content-length"];
    if (contentLength !== undefined &&
        (!/^(0|[1-9]\d*)$/.test(contentLength) || Number(contentLength) > MAX_REQUEST_BODY_BYTES)) {
      req.resume();
      reject(requestError("BODY_TOO_LARGE"));
      return;
    }

    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = code => {
      if (settled) return;
      settled = true;
      reject(requestError(code));
    };

    req.on("data", chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_REQUEST_BODY_BYTES) {
        req.resume();
        fail("BODY_TOO_LARGE");
        return;
      }
      chunks.push(chunk);
    });
    req.once("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(requestError("INVALID_JSON"));
      }
    });
    req.once("error", () => fail("INVALID_JSON"));
    req.once("aborted", () => fail("INVALID_JSON"));
  });
}

function auditStatus(auditAdapter) {
  if (!auditAdapter || typeof auditAdapter.verify !== "function") {
    return { status: 503, body: { ok: false, error: "AUDIT_UNAVAILABLE" } };
  }
  try {
    const verification = auditAdapter.verify();
    const headSequence = Number.isSafeInteger(auditAdapter.size) && auditAdapter.size >= 0
      ? auditAdapter.size : null;
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

function safePolicyResult(result) {
  if (!result || !["ALLOW", "DENY", "BLOCKED"].includes(result.decision) ||
      result.executionStarted !== false) {
    return { decision: "BLOCKED", reason: "POLICY_RESULT_INVALID", executionStarted: false };
  }
  const reason = typeof result.reason === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(result.reason)
    ? result.reason : "POLICY_EVALUATED";
  return Object.freeze({ decision: result.decision, reason, executionStarted: false });
}

async function handleRequest(req, res, dependencies) {
  try {
    const requestTarget = req.url;
    if (typeof requestTarget !== "string" || requestTarget.length > MAX_REQUEST_TARGET_LENGTH ||
        !requestTarget.startsWith("/")) {
      sendJson(res, 400, { ok: false, error: "INVALID_REQUEST_TARGET" }, req.method);
      return;
    }

    const url = new URL(requestTarget, "http://server.invalid");
    if (url.origin !== "http://server.invalid") {
      sendJson(res, 400, { ok: false, error: "INVALID_REQUEST_TARGET" }, req.method);
      return;
    }

    const validationPost = req.method === "POST" && url.pathname === "/v1/tasks/validate";
    const intakePost = req.method === "POST" && url.pathname === "/v1/tasks/intake";
    if (!new Set(["GET", "HEAD"]).has(req.method) && !validationPost && !intakePost) {
      const intakePath = url.pathname === "/v1/tasks/intake";
      const validationPath = url.pathname === "/v1/tasks/validate";
      res.setHeader("Allow", intakePath || validationPath ? "GET, HEAD, POST" : "GET, HEAD");
      sendJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" }, req.method);
      return;
    }

    if (url.pathname === "/health" || url.pathname === "/health/live") {
      sendJson(res, 200, {
        ok: true, service: SERVICE_NAME, health: { liveness: "healthy" }
      }, req.method);
      return;
    }

    if (url.pathname === "/health/ready") {
      sendJson(res, 200, {
        ok: true, service: SERVICE_NAME,
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
        capabilities: {
          taskValidation: true,
          policyEvaluation: true,
          taskAdmission: false,
          taskExecution: false,
          externalWrites: false
        },
        modules: dependencies.statusRegistry.list()
      }, req.method);
      return;
    }

    if (url.pathname === "/v1/audit/status") {
      const result = auditStatus(dependencies.auditAdapter);
      sendJson(res, result.status, result.body, req.method);
      return;
    }

    if (validationPost || intakePost) {
      let input;
      try {
        input = await readJsonBody(req);
      } catch (error) {
        const code = error?.code;
        const status = code === "UNSUPPORTED_MEDIA_TYPE" ? 415 : code === "BODY_TOO_LARGE" ? 413 : 400;
        const publicError = code === "UNSUPPORTED_MEDIA_TYPE" ? code :
          code === "BODY_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_JSON";
        sendJson(res, status, { ok: false, error: publicError }, req.method);
        return;
      }

      const validated = validateTaskEnvelope(input);
      if (!validated.ok) {
        sendJson(res, 400, {
          ok: false, valid: false, schemaVersion: TASK_SCHEMA, errors: validated.errors
        }, req.method);
        return;
      }

      if (validationPost) {
        sendJson(res, 200, {
          ok: true, valid: true, schemaVersion: TASK_SCHEMA,
          admitted: false, executionStarted: false
        }, req.method);
        return;
      }

      const task = validated.value;
      let policy;
      try {
        policy = safePolicyResult(await dependencies.policyGate.evaluate(task));
      } catch {
        policy = { decision: "BLOCKED", reason: "POLICY_EVALUATION_FAILED", executionStarted: false };
      }

      let auditResult;
      try {
        auditResult = dependencies.auditAdapter.recordIntakeDecision({ taskId: task.task_id, policy });
      } catch {
        auditResult = { ok: false };
      }
      if (!auditResult?.ok) {
        sendJson(res, 503, { ok: false, error: "AUDIT_WRITE_UNAVAILABLE", admitted: false, executionStarted: false }, req.method);
        return;
      }

      sendJson(res, policy.decision === "BLOCKED" ? 503 : 200, {
        ok: policy.decision !== "BLOCKED",
        apiVersion: API_VERSION,
        taskId: task.task_id,
        valid: true,
        policy,
        admitted: false,
        executionStarted: false
      }, req.method);
      return;
    }

    if (url.pathname === "/") {
      sendJson(res, 200, {
        ok: true, service: SERVICE_NAME, apiVersion: API_VERSION, mode: "foundation"
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

/** Modules run in one local process; no background worker or task executor is started. */
export function createServerApp({
  statusRegistry = createInMemoryStatusRegistry(),
  auditAdapter = createInMemoryAuditAdapter(),
  policyGate = createPolicyGate()
} = {}) {
  const dependencies = { statusRegistry, auditAdapter, policyGate };
  return createServer({
    maxHeaderSize: MAX_HEADER_SIZE,
    requestTimeout: 10_000,
    headersTimeout: 5_000,
    keepAliveTimeout: 5_000
  }, (req, res) => handleRequest(req, res, dependencies));
}
