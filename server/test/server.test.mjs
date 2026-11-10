import test from "node:test";
import assert from "node:assert/strict";
import { createServerApp } from "../src/app.mjs";
import { loadServerConfig } from "../src/config.mjs";

async function withServer(run, options) {
  const server = createServerApp(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

const validTask = () => ({
  schema_version: "kratt-prime/v0.1",
  task_id: "inventory-17",
  actor: "repo-scout",
  action: "repo.read",
  target: { resource_type: "repository", resource_id: "example/project" },
  constraints: {},
  required_evidence: [],
  created_at: "2026-11-09T12:00:00Z",
  requested_authority: ["repository.read"],
  status: "PENDING"
});

test("server config uses safe local defaults and freezes its result", () => {
  const config = loadServerConfig({});
  assert.deepEqual(config, { host: "127.0.0.1", port: 3000, nodeEnv: "development" });
  assert.equal(Object.isFrozen(config), true);
  assert.deepEqual(loadServerConfig({ HOST: "127.0.0.1", PORT: "8080", NODE_ENV: "production" }), {
    host: "127.0.0.1", port: 8080, nodeEnv: "production"
  });
  assert.deepEqual(loadServerConfig({ HOST: "::1" }).host, "::1");
});

test("server config rejects malformed ports, public hosts, and runtime modes", () => {
  for (const env of [
    { PORT: "-1" },
    { PORT: "65536" },
    { PORT: "3.5" },
    { HOST: "bad host" },
    { HOST: "0.0.0.0" },
    { HOST: "192.168.1.10" },
    { NODE_ENV: "unknown" }
  ]) {
    assert.throws(() => loadServerConfig(env), TypeError);
  }
});

test("structured status and health endpoints report bounded capabilities", async () => {
  await withServer(async baseUrl => {
    const health = await fetch(`${baseUrl}/health/live`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "kratt-prime-server",
      health: { liveness: "healthy" }
    });

    const ready = await fetch(`${baseUrl}/health/ready`);
    assert.deepEqual(await ready.json(), {
      ok: true,
      service: "kratt-prime-server",
      health: { readiness: "ready", executionEnabled: false }
    });

    const status = await fetch(`${baseUrl}/v1/status`);
    assert.deepEqual(await status.json(), {
      ok: true,
      apiVersion: "v1",
      service: "kratt-prime-server",
      mode: "foundation",
      capabilities: {
        taskValidation: true,
        taskExecution: false,
        externalWrites: false,
        auditReadiness: true
      }
    });
  });
});

test("audit endpoint reports only integrity metadata and fails closed when absent", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/v1/audit/status`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: "AUDIT_UNAVAILABLE" });
  });

  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/v1/audit/status`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      audit: { availability: "available", integrity: "verified", headSequence: 4 }
    });
  }, { auditLedger: { verify: () => ({ ok: true }), size: 4 } });
});

test("task validation endpoint validates schema but never admits or executes tasks", async () => {
  await withServer(async baseUrl => {
    const valid = await fetch(`${baseUrl}/v1/tasks/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validTask())
    });
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), {
      ok: true,
      valid: true,
      schemaVersion: "kratt-prime/v0.1",
      admitted: false,
      executionStarted: false
    });

    const invalid = await fetch(`${baseUrl}/v1/tasks/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validTask(), unexpected: true })
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), {
      ok: false,
      valid: false,
      schemaVersion: "kratt-prime/v0.1",
      errors: ["TASK_SHAPE_INVALID"]
    });
  });
});

test("task validation enforces content type and body size", async () => {
  await withServer(async baseUrl => {
    const wrongType = await fetch(`${baseUrl}/v1/tasks/validate`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    });
    assert.equal(wrongType.status, 415);

    const tooLarge = await fetch(`${baseUrl}/v1/tasks/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(33 * 1024) })
    });
    assert.equal(tooLarge.status, 413);
    assert.deepEqual(await tooLarge.json(), { ok: false, error: "REQUEST_TOO_LARGE" });
  });
});

test("unknown paths and unsupported methods fail with generic JSON errors", async () => {
  await withServer(async baseUrl => {
    const missing = await fetch(`${baseUrl}/private`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { ok: false, error: "NOT_FOUND" });

    const write = await fetch(`${baseUrl}/health`, { method: "DELETE" });
    assert.equal(write.status, 405);
    assert.equal(write.headers.get("allow"), "GET, HEAD");
    assert.deepEqual(await write.json(), { ok: false, error: "METHOD_NOT_ALLOWED" });
  });
});
