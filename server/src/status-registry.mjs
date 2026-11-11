const MODULE_DEFINITIONS = Object.freeze([
  Object.freeze({ moduleId: "http-server", capabilities: Object.freeze(["health", "status", "task-intake"]) }),
  Object.freeze({ moduleId: "status-registry", capabilities: Object.freeze(["in-memory", "bounded", "read-only-api"]) }),
  Object.freeze({ moduleId: "audit-ledger", capabilities: Object.freeze(["append-only", "hash-chained", "local-only"]) }),
  Object.freeze({ moduleId: "policy-gate", capabilities: Object.freeze(["fail-closed", "injected-runtime", "no-execution"]) }),
  Object.freeze({ moduleId: "task-intake", capabilities: Object.freeze(["schema-validation", "policy-check", "no-admission"]) })
]);
const STATES = new Set(["READY", "BLOCKED", "DEGRADED", "NOT_CONFIGURED"]);

function freezeRow(row) {
  return Object.freeze({
    moduleId: row.moduleId,
    state: row.state,
    updatedAt: row.updatedAt,
    capabilities: Object.freeze([...row.capabilities]),
    executionEnabled: false
  });
}

/** Fixed five-row by five-field in-memory status matrix; never stores arbitrary payloads. */
export function createInMemoryStatusRegistry({ now = () => new Date().toISOString() } = {}) {
  const rows = new Map(MODULE_DEFINITIONS.map(definition => [definition.moduleId, freezeRow({
    moduleId: definition.moduleId,
    state: definition.moduleId === "policy-gate" ? "BLOCKED" : "READY",
    updatedAt: now(),
    capabilities: definition.capabilities
  })]));

  return Object.freeze({
    list() {
      return Object.freeze(MODULE_DEFINITIONS.map(({ moduleId }) => freezeRow(rows.get(moduleId))));
    },
    update(moduleId, state) {
      if (!rows.has(moduleId) || !STATES.has(state)) return { ok: false, reason: "STATUS_UPDATE_INVALID" };
      const current = rows.get(moduleId);
      rows.set(moduleId, freezeRow({ ...current, state, updatedAt: now() }));
      return Object.freeze({ ok: true, row: freezeRow(rows.get(moduleId)) });
    }
  });
}

export const STATUS_MATRIX_SHAPE = Object.freeze({ rows: 5, columns: 5 });
