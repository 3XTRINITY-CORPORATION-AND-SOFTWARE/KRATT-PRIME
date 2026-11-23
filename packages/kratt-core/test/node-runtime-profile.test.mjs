import test from "node:test";
import assert from "node:assert/strict";
import {
  collectNodeRuntimeProfile,
  NODE_RUNTIME_PROFILE_SCHEMA
} from "../src/node-runtime-profile.mjs";

const fakeRuntime = () => ({
  versions: { node: "26.13.0", v8: "14.2.0", modules: "144", napi: "10" },
  platform: "linux",
  arch: "arm64",
  memoryUsage: () => ({
    rss: 4096, heapTotal: 2048, heapUsed: 1024, external: 128, arrayBuffers: 64
  })
});
const fakeOs = () => ({
  cpus: () => [{}, {}, {}, {}],
  availableParallelism: () => 3,
  totalmem: () => 8192,
  freemem: () => 4096
});

test("collects a bounded, privacy-minimal Node runtime profile", () => {
  const result = collectNodeRuntimeProfile({
    runtime: fakeRuntime(),
    osApi: fakeOs(),
    clock: () => Date.UTC(2026, 10, 8)
  });
  assert.equal(result.ok, true);
  assert.equal(result.profile.schemaVersion, NODE_RUNTIME_PROFILE_SCHEMA);
  assert.equal(result.profile.runtime.major, 26);
  assert.equal(result.profile.host.architecture, "arm64");
  assert.equal(result.profile.host.cpuCount, 4);
  assert.equal(result.profile.host.availableParallelism, 3);
  assert.equal(result.profile.host.memory.freeBytes, 4096);
  assert.equal(result.profile.processMemory.rssBytes, 4096);
  assert.equal(Object.isFrozen(result.profile), true);
  assert.equal("hostname" in result.profile.host, false);
  assert.equal("env" in result.profile, false);
  assert.equal("pid" in result.profile, false);
});

test("rejects an absent or malformed Node version", () => {
  assert.equal(
    collectNodeRuntimeProfile({ runtime: {}, osApi: fakeOs() }).reason,
    "NODE_RUNTIME_UNAVAILABLE"
  );
  assert.equal(
    collectNodeRuntimeProfile({
      runtime: { versions: { node: "not-a-version" } },
      osApi: fakeOs()
    }).reason,
    "NODE_VERSION_INVALID"
  );
});

test("degrades unavailable OS and memory probes to null without failing", () => {
  const result = collectNodeRuntimeProfile({
    runtime: fakeRuntime(),
    osApi: {
      cpus: () => { throw new Error("probe unavailable"); },
      totalmem: () => { throw new Error("probe unavailable"); },
      freemem: () => null
    },
    clock: () => Date.UTC(2026, 10, 8)
  });
  assert.equal(result.ok, true);
  assert.equal(result.profile.host.cpuCount, null);
  assert.equal(result.profile.host.memory.totalBytes, null);
  assert.equal(result.profile.host.memory.freeBytes, null);
});

test("observational time failure is explicit and never replaced silently", () => {
  const result = collectNodeRuntimeProfile({
    runtime: fakeRuntime(),
    osApi: fakeOs(),
    clock: () => Number.NaN
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "OBSERVATION_CLOCK_UNAVAILABLE");
});
