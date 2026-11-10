import test from "node:test";
import assert from "node:assert/strict";
import { createServerApp } from "../src/app.mjs";
import { loadServerConfig } from "../src/config.mjs";

async function withServer(run) {
  const server = createServerApp();
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

test("server config uses safe local defaults and freezes its result", () => {
  const config = loadServerConfig({});
  assert.deepEqual(config, { host: "127.0.0.1", port: 3000, nodeEnv: "development" });
  assert.equal(Object.isFrozen(config), true);
  assert.deepEqual(loadServerConfig({ HOST: "0.0.0.0", PORT: "8080", NODE_ENV: "production" }), {
    host: "0.0.0.0", port: 8080, nodeEnv: "production"
  });
});

test("server config rejects malformed ports, hosts, and runtime modes", () => {
  for (const env of [
    { PORT: "-1" },
    { PORT: "65536" },
    { PORT: "3.5" },
    { HOST: "bad host" },
    { NODE_ENV: "unknown" }
  ]) {
    assert.throws(() => loadServerConfig(env), TypeError);
  }
});

test("health and root routes return only stable public status fields", async () => {
  await withServer(async baseUrl => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "kratt-prime-server",
      status: "healthy"
    });

    const root = await fetch(`${baseUrl}/`);
    assert.equal(root.status, 200);
    assert.deepEqual(await root.json(), {
      ok: true,
      service: "kratt-prime-server",
      mode: "foundation"
    });
  });
});

test("unknown paths and unsupported methods fail with generic JSON errors", async () => {
  await withServer(async baseUrl => {
    const missing = await fetch(`${baseUrl}/private`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { ok: false, error: "NOT_FOUND" });

    const write = await fetch(`${baseUrl}/health`, { method: "POST" });
    assert.equal(write.status, 405);
    assert.equal(write.headers.get("allow"), "GET, HEAD");
    assert.deepEqual(await write.json(), { ok: false, error: "METHOD_NOT_ALLOWED" });
  });
});
