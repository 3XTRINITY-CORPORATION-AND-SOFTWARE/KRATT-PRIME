# KRATT PRIME server foundation

This package is a small, read-only Node.js HTTP starting point kept separate from the Vite/AURA frontend.

## Run locally

Requires Node.js 22. Start with `npm run server`. Defaults bind only to `127.0.0.1:3000`; set `HOST` or `PORT` explicitly when needed. `PORT=0` asks the operating system for an available port.

Available routes:

- `GET /health` — static health response.
- `GET /` — static service/mode response.

All other paths return a generic 404, and methods other than GET/HEAD are rejected. There are no task execution, database, provider, authentication, or deployment integrations in this foundation. Do not expose it publicly or treat the health endpoint as an authorization boundary.

Run tests with `npm test`.
