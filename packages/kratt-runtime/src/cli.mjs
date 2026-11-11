import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { createBranchManager, createRootClaim } from "./evidence-kernel.mjs";
import { loadRuntimeConfig } from "./config.mjs";
import { createLogger } from "./logger.mjs";
import { createLocalGitRepositorySource } from "./local-git-source.mjs";
import { createReadOnlyRepositoryIndexer } from "./repository-index.mjs";
import { persistRepositoryIndexEvidence } from "./repository-evidence-pipeline.mjs";
import { DurableEvidenceRepository } from "./durable-evidence.mjs";
import { PrimeStore } from "../../kratt-core/src/prime-store.mjs";
import { createWorkerLeaseCoordinator } from "./worker-lease-coordinator.mjs";
import { createRuntimeServer } from "./server.mjs";

const OPTIONS = {
  verify: new Set(["journal"]),
  index: new Set(["repo", "revision", "journal", "root-id", "root-statement", "branch-id", "question", "actor-id", "occurred-at"])
};

function parseOptions(args, allowed) {
  const options = Object.create(null);
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!/^--[a-z][a-z-]*$/.test(key ?? "")) return { ok: false, reason: "OPTION_INVALID" };
    const name = key.slice(2);
    if (!allowed.has(name)) return { ok: false, reason: "OPTION_UNKNOWN" };
    const value = args[index + 1];
    if (typeof value !== "string" || value.startsWith("--") || Object.hasOwn(options, name)) return { ok: false, reason: "OPTION_VALUE_INVALID" };
    options[name] = value;
    index += 1;
  }
  return { ok: true, options };
}

function requireOptions(options, names) {
  return names.every(name => typeof options[name] === "string" && options[name].length > 0);
}

function printJson(stdout, value) { stdout.write(`${JSON.stringify(value)}\n`); }

const HELP = `KRATT PRIME local evidence runtime

Usage:
  node packages/kratt-runtime/src/cli.mjs [serve]
  node packages/kratt-runtime/src/cli.mjs verify --journal <absolute-path>
  node packages/kratt-runtime/src/cli.mjs index --repo <absolute-path> --revision <40-char-commit-sha> --journal <absolute-path> --root-id <id> --root-statement <text> --branch-id <id> --question <text> --actor-id <id> --occurred-at <UTC-time>

Serve exposes loopback-only GET health and evidence inspection routes. Index is an explicit local write to the evidence journal; the Git repository source is read-only. Use the same arguments and timestamp to resume an interrupted index operation.
`;

async function runServe({ env, stdout, stderr }) {
  let config;
  try { config = loadRuntimeConfig(env); }
  catch (error) { stderr.write(`${error.code ?? "CONFIGURATION_INVALID"}: ${error.message}\n`); return 1; }
  const logger = createLogger({ level: config.logLevel });
  const repository = config.journalPath ? new DurableEvidenceRepository({ path: config.journalPath }) : null;
  const leaseCoordinator = config.leaseJournalPath ? createWorkerLeaseCoordinator({ store: new PrimeStore({ path: config.leaseJournalPath }) }) : null;
  const runtime = createRuntimeServer({ config, logger, evidenceRepository: repository, leaseCoordinator });
  let stopping = false;
  let shutdownResult = 0;
  let timeout;
  const shutdown = async signal => {
    if (stopping) return;
    stopping = true;
    logger.info("runtime shutdown requested", { signal });
    timeout = setTimeout(() => { logger.error("runtime shutdown timed out"); shutdownResult = 1; process.exitCode = 1; }, 10_000);
    timeout.unref();
    try { await runtime.close(); logger.info("runtime stopped"); }
    catch { logger.error("runtime shutdown failed"); shutdownResult = 1; process.exitCode = 1; }
    finally { clearTimeout(timeout); }
  };
  const listeners = new Map(["SIGINT", "SIGTERM"].map(signal => [signal, () => void shutdown(signal)]));
  for (const [signal, listener] of listeners) process.once(signal, listener);
  const closed = new Promise(resolve => runtime.server.once("close", () => resolve(shutdownResult)));
  try {
    if (repository) await repository.open();
    if (leaseCoordinator) await leaseCoordinator.open();
    const address = await runtime.listen();
    printJson(stdout, { ok: true, mode: "local", address: typeof address === "object" ? address.address : config.host,
      port: typeof address === "object" ? address.port : config.port, evidenceStore: repository ? "configured" : "unavailable",
      leaseStore: leaseCoordinator ? "configured" : "unavailable" });
    return await closed;
  } catch (error) {
    logger.error("runtime startup failed", { code: error?.code ?? "STARTUP_FAILED" });
    try { await runtime.close(); } catch { /* startup may have failed before listen */ }
    return 1;
  } finally {
    for (const [signal, listener] of listeners) process.off(signal, listener);
  }
}

async function runVerify(options, { stdout, stderr }) {
  if (!requireOptions(options, ["journal"]) || !isAbsolute(options.journal)) {
    stderr.write("INPUT_INVALID: --journal must be an absolute path\n"); return 1;
  }
  try {
    const repository = new DurableEvidenceRepository({ path: options.journal });
    const result = await repository.verify();
    printJson(stdout, result);
    return result.ok ? 0 : 1;
  } catch {
    printJson(stdout, { ok: false, error: "EVIDENCE_VERIFICATION_FAILED" });
    return 1;
  }
}

async function runIndex(options, { stdout, stderr }) {
  const required = ["repo", "revision", "journal", "root-id", "root-statement", "branch-id", "question", "actor-id", "occurred-at"];
  if (!requireOptions(options, required) || !isAbsolute(options.repo) || !isAbsolute(options.journal) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(options["occurred-at"])) {
    stderr.write("INPUT_INVALID: explicit absolute paths, identifiers, root/branch text and UTC event time are required\n"); return 1;
  }
  const root = createRootClaim({ rootId: options["root-id"], statement: options["root-statement"], revision: options.revision });
  if (!root.ok) { stderr.write(`${root.reason}\n`); return 1; }
  const branchManager = createBranchManager(root.claim);
  const branch = branchManager.create({ branchId: options["branch-id"], question: options.question });
  if (!branch.ok) { stderr.write(`${branch.reason}\n`); return 1; }

  try {
    const source = createLocalGitRepositorySource({ repoPath: options.repo });
    const indexer = createReadOnlyRepositoryIndexer(source);
    const repository = new DurableEvidenceRepository({ path: options.journal });
    const result = await persistRepositoryIndexEvidence({ indexer, repository, rootClaim: root.claim,
      branch: branch.branch, actorId: options["actor-id"], occurredAt: options["occurred-at"] });
    printJson(stdout, { ok: result.ok, status: result.status, reason: result.reason ?? null,
      revision: result.revision ?? options.revision, indexedCount: result.indexedCount ?? 0,
      persistedCount: result.persistedCount ?? 0, duplicateCount: result.duplicateCount ?? 0,
      failedCardId: result.failedCardId ?? null, cardIds: (result.cards ?? []).map(card => card.cardId),
      externalTransfer: false });
    return result.ok ? 0 : result.status === "PARTIAL" ? 2 : 1;
  } catch {
    printJson(stdout, { ok: false, status: "REJECTED", reason: "LOCAL_INDEX_FAILED", externalTransfer: false });
    return 1;
  }
}

export async function runOperatorCli(args = process.argv.slice(2), io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const env = io.env ?? process.env;
  const command = args[0] ?? "serve";
  if (command === "--help" || command === "help") { stdout.write(HELP); return 0; }
  if (command === "serve") {
    if (args.length > 1) { stderr.write("OPTION_UNKNOWN: serve accepts configuration through KRATT_* environment variables\n"); return 1; }
    return runServe({ env, stdout, stderr });
  }
  if (!Object.hasOwn(OPTIONS, command)) { stderr.write("COMMAND_UNKNOWN: use serve, verify or index\n"); return 1; }
  const parsed = parseOptions(args.slice(1), OPTIONS[command]);
  if (!parsed.ok) { stderr.write(`${parsed.reason}\n`); return 1; }
  if (command === "verify") return runVerify(parsed.options, { stdout, stderr });
  return runIndex(parsed.options, { stdout, stderr });
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) process.exitCode = await runOperatorCli();


