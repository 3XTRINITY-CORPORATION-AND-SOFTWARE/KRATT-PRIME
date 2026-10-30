# AURA — Web surface

Browser / PWA entry for AURA.

**Canonical app:** repository root (`index.html`, `src/`, `vite.config.ts`, `vercel.json`) — lean Vite shell synced from `/workspace/trinitywayve-aura` (excluding `node_modules/` / `dist/`).  
This directory is the **program surface doc**; do not duplicate the Vite app here.

A nested `trinitywayve-aura/` tree may also exist as a hub mirror; **prefer the repo-root `src/` app** for builds and deploy.

```bash
# from repo root
npm install && npm run typecheck && npm run build
```

- Live today (reference): https://trinitywayve-aura.vercel.app
- Target project: **`aura-3xtrinity`** → `aura-3xtrinity.vercel.app`
- `aura.vercel.app` is **not** a target (`DEPLOYMENT_DISABLED`).

Do not deploy from this change; deployment remains with the Deploy Captain after an explicit GO.
