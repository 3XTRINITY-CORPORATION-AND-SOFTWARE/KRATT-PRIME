import { loadRuntimeConfig } from "./config.mjs";
import { createLogger } from "./logger.mjs";
import { createRuntimeServer } from "./server.mjs";

const config = loadRuntimeConfig();
const logger = createLogger({ level: config.logLevel });
const runtime = createRuntimeServer({ config, logger });
let stopping = false;

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info("runtime shutdown requested", { signal });
  const timeout = setTimeout(() => { logger.error("runtime shutdown timed out"); process.exitCode = 1; }, 10_000);
  timeout.unref();
  try { await runtime.close(); logger.info("runtime stopped"); }
  catch { logger.error("runtime shutdown failed"); process.exitCode = 1; }
}

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => void shutdown(signal));
try {
  const address = await runtime.listen();
  logger.info("runtime listening", { address: typeof address === "object" ? address.address : config.host,
    port: typeof address === "object" ? address.port : config.port, mode: config.mode });
} catch (error) {
  logger.error("runtime startup failed", { code: error?.code ?? "STARTUP_FAILED" });
  process.exitCode = 1;
}
