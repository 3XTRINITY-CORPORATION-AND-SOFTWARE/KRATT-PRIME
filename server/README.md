# KRATT PRIME server foundation

This package is a small, read-only Node.js HTTP starting point kept separate from the Vite/AURA frontend.

## Run locally

Requires Node.js 22. Start with `npm run server`. Defaults bind only to `127.0.0.1:3000`; set `HOST` only to a loopback address and `PORT` explicitly when needed. `PORT=0` asks the operating system for an available port.

See [API-CONTRACT.md](API-CONTRACT.md) for the route contract and limitations. The foundation has no authentication, task admission or execution, database, provider, or deployment integration. Do not expose it publicly or treat health/status routes as an authorization boundary.

Run tests with `npm test`.
