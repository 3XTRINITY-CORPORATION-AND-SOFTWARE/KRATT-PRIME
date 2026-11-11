# KRATT PRIME server foundation

Small, local-only Node.js HTTP server kept separate from the Vite/AURA frontend.

## Run locally

Requires Node.js 22. Run `npm run server`. Defaults to `127.0.0.1:3000`; non-loopback `HOST` values are rejected. `PORT=0` requests an available local port.

See [API-CONTRACT.md](API-CONTRACT.md) for routes and limits. Status and audit adapters are in-memory demo interfaces. No authentication, persistence, task admission, execution, provider integration, or deployment is enabled. Never expose this server publicly.

Run `npm test` for core and server tests.
