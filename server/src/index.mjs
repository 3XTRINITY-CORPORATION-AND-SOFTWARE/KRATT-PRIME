import { createServerApp } from "./app.mjs";
import { loadServerConfig } from "./config.mjs";
import { createInMemoryAuditAdapter } from "./audit-adapter.mjs";
import { createInMemoryStatusRegistry } from "./status-registry.mjs";
import { createPolicyGate } from "./policy-gate.mjs";

const config = loadServerConfig();
const statusRegistry = createInMemoryStatusRegistry();
const auditAdapter = createInMemoryAuditAdapter();
const policyGate = createPolicyGate();
const server = createServerApp({ statusRegistry, auditAdapter, policyGate });

server.on("error", () => {
  // Avoid logging request data, configuration values, or internal exception details.
  process.exitCode = 1;
});

server.listen(config.port, config.host, () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  console.info(`KRATT PRIME server foundation listening on ${config.host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.close(() => {
      process.exitCode = 0;
    });
  });
}
