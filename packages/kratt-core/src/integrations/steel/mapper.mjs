import { validateTaskEnvelope } from "../../contracts.mjs";

export const KRATT_STEEL_ADAPTER_VERSION = "kratt-steel/v1";
export const STEEL_PROTOCOL_VERSION = 1;

const TASK_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const SHA1 = /^[0-9a-f]{40}$/;
const TOKEN = /^[a-z][a-z0-9:_-]{0,63}$/;
const REL_PATH = /^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/;
const FORBIDDEN_ACTIONS = Object.freeze([
  "branch:write",
  "repo:write",
  "merge",
  "deploy",
  "secret:read"
]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function validRoute(route) {
  if (!isPlainObject(route)) return false;
  const allowed = new Set([
    "repository", "branch", "base_sha", "scope",
    "required_evidence", "resource_budget"
  ]);
  const keys = Reflect.ownKeys(route);
  if (keys.some(key => typeof key !== "string" || !allowed.has(key))) return false;
  if ([...allowed].some(key => !Object.hasOwn(route, key))) return false;
  if (keys.some(key => {
    const descriptor = Object.getOwnPropertyDescriptor(route, key);
    return !descriptor || !("value" in descriptor) || descriptor.get || descriptor.set;
  })) return false;

  const budget = route.resource_budget;
  if (!isPlainObject(budget) ||
      !Number.isInteger(budget.max_wall_ms) || budget.max_wall_ms < 100 || budget.max_wall_ms > 600_000 ||
      !Number.isInteger(budget.max_output_bytes) || budget.max_output_bytes < 1024 || budget.max_output_bytes > 1_048_576 ||
      !Number.isInteger(budget.max_files) || budget.max_files < 1 || budget.max_files > 64 ||
      Reflect.ownKeys(budget).some(key => !["max_wall_ms", "max_output_bytes", "max_files"].includes(key))) {
    return false;
  }

  return REPOSITORY.test(route.repository ?? "") &&
    typeof route.branch === "string" &&
    route.branch.startsWith("feature/") &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(route.branch) &&
    !route.branch.includes("..") &&
    !route.branch.endsWith("/") &&
    !route.branch.endsWith(".") &&
    SHA1.test(route.base_sha ?? "") &&
    Array.isArray(route.scope) && route.scope.length > 0 && route.scope.length <= 64 &&
    new Set(route.scope).size === route.scope.length &&
    route.scope.every(path =>
      typeof path === "string" && path.length <= 200 &&
      REL_PATH.test(path) && !path.split("/").every(part => part === "." || part === "..")
    ) &&
    Array.isArray(route.required_evidence) &&
    route.required_evidence.length > 0 && route.required_evidence.length <= 16 &&
    route.required_evidence.every(item => typeof item === "string" && TOKEN.test(item));
}

/**
 * Local-only KRATT -> STEEL envelope mapper.
 *
 * authorizeTask must be supplied by KRATT's trusted composition root and must
 * evaluate the already validated task using KRATT policy. This function never
 * contacts STEEL, GitHub, or any remote service.
 */
export async function mapKrattTaskToSteel(taskInput, {
  route,
  authorizeTask
} = {}) {
  const validated = validateTaskEnvelope(taskInput);
  if (!validated.ok) return { ok: false, reason: "KRATT_TASK_INVALID" };

  const task = validated.value;
  if (task.action !== "repo.read" || task.target.resource_type !== "repository") {
    return { ok: false, reason: "UNSUPPORTED_KRATT_OPERATION" };
  }
  if (!TASK_ID.test(task.task_id)) {
    return { ok: false, reason: "TASK_ID_NOT_STEEL_COMPATIBLE" };
  }
  if (!validRoute(route) || route.repository !== task.target.resource_id) {
    return { ok: false, reason: "STEEL_ROUTE_INVALID_OR_OUT_OF_SCOPE" };
  }
  if (typeof authorizeTask !== "function") {
    return { ok: false, reason: "KRATT_AUTHORIZATION_UNAVAILABLE" };
  }

  let authorized = false;
  try {
    authorized = await authorizeTask(Object.freeze({
      task,
      operation: "repo.read",
      repository: route.repository,
      branch: route.branch,
      scope: Object.freeze([...route.scope])
    })) === true;
  } catch {
    authorized = false;
  }
  if (!authorized) return { ok: false, reason: "KRATT_AUTHORIZATION_DENIED" };

  const steelTask = Object.freeze({
    task_id: task.task_id,
    factory: "FORGE",
    agent_id: "FORGE-002",
    objective: `Read-only repository inventory for ${route.repository}`,
    repository: route.repository,
    branch: route.branch,
    base_sha: route.base_sha,
    scope: Object.freeze([...route.scope]),
    allowed_actions: Object.freeze(["repo:map-tree"]),
    forbidden_actions: FORBIDDEN_ACTIONS,
    required_evidence: Object.freeze([...route.required_evidence]),
    resource_budget: Object.freeze({ ...route.resource_budget }),
    protocol_version: STEEL_PROTOCOL_VERSION
  });

  return {
    ok: true,
    adapter_version: KRATT_STEEL_ADAPTER_VERSION,
    correlation_id: task.task_id,
    task: steelTask
  };
}
