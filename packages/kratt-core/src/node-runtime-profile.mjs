/**
 * KRATT PRIME — privacy-minimal Node.js host runtime profile.
 *
 * Read-only process/OS observation. This module does not inspect env vars,
 * hostname, user identity, device serials, secrets, or execute host commands.
 * Its timestamp is observational metadata, NOT a trusted authorization clock.
 */
import os from "node:os";
import process from "node:process";

export const NODE_RUNTIME_PROFILE_SCHEMA = "kratt-node-runtime-profile/v1";

const nonNegativeSafeInteger = value =>
  Number.isSafeInteger(value) && value >= 0 ? value : null;

function safeCall(fn) {
  try {
    return typeof fn === "function" ? fn() : null;
  } catch {
    return null;
  }
}

function freezeProfile(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeProfile(child);
    Object.freeze(value);
  }
  return value;
}

function parseNodeVersion(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) return null;
  const [major, minor, patch] = match.slice(1).map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch };
}

export function collectNodeRuntimeProfile({
  runtime = process,
  osApi = os,
  clock = () => Date.now()
} = {}) {
  if (!runtime || typeof runtime !== "object" ||
      !runtime.versions || typeof runtime.versions !== "object") {
    return { ok: false, reason: "NODE_RUNTIME_UNAVAILABLE" };
  }

  const version = parseNodeVersion(runtime.versions.node);
  if (!version) return { ok: false, reason: "NODE_VERSION_INVALID" };

  const observedAtMs = safeCall(clock);
  if (!Number.isFinite(observedAtMs) || observedAtMs <= 0) {
    return { ok: false, reason: "OBSERVATION_CLOCK_UNAVAILABLE" };
  }

  const rawMemory = safeCall(() => runtime.memoryUsage?.()) ?? {};
  const rawCpus = safeCall(() => osApi.cpus?.());
  const cpuCount = Array.isArray(rawCpus) && rawCpus.length > 0
    ? rawCpus.length : null;
  const availableParallelism = nonNegativeSafeInteger(
    safeCall(() => osApi.availableParallelism?.())
  );

  const memory = Object.freeze({
    totalBytes: nonNegativeSafeInteger(safeCall(() => osApi.totalmem?.())),
    freeBytes: nonNegativeSafeInteger(safeCall(() => osApi.freemem?.()))
  });
  const processMemory = Object.freeze({
    rssBytes: nonNegativeSafeInteger(rawMemory.rss),
    heapTotalBytes: nonNegativeSafeInteger(rawMemory.heapTotal),
    heapUsedBytes: nonNegativeSafeInteger(rawMemory.heapUsed),
    externalBytes: nonNegativeSafeInteger(rawMemory.external),
    arrayBuffersBytes: nonNegativeSafeInteger(rawMemory.arrayBuffers)
  });

  const runtimeInfo = Object.freeze({
    name: "node",
    version: runtime.versions.node,
    major: version.major,
    minor: version.minor,
    patch: version.patch,
    v8: typeof runtime.versions.v8 === "string" ? runtime.versions.v8 : null,
    modulesAbi: typeof runtime.versions.modules === "string" ? runtime.versions.modules : null,
    napi: typeof runtime.versions.napi === "string" ? runtime.versions.napi : null
  });

  const host = Object.freeze({
    platform: typeof runtime.platform === "string" ? runtime.platform : "unknown",
    architecture: typeof runtime.arch === "string" ? runtime.arch : "unknown",
    cpuCount,
    availableParallelism: availableParallelism ?? cpuCount,
    memory
  });

  const profile = freezeProfile({
    schemaVersion: NODE_RUNTIME_PROFILE_SCHEMA,
    observedAt: new Date(observedAtMs).toISOString(),
    runtime: runtimeInfo,
    host,
    processMemory
  });

  return Object.freeze({ ok: true, profile });
}
