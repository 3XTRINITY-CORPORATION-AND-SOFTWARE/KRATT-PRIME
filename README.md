# AURA — 3XTRINITY CORPORATION visualizer

**AURA** is a **separate program** (not a TrinityWayve submodule).

Lab visualizer / presence art, designed to sync with **STEEL**. Surfaces:

| Surface | Path | Status |
|---------|------|--------|
| **OS** | `programs/os/` | Overlay / desktop shell (planned) |
| **Web** | `programs/web/` | Vite PWA shell — **canonical app at repo root** |
| **Android** | `programs/android/` | Capacitor / store later |

## Product

- **Copy:** Aura · Lab visualizer · caps · modes · CTA **Arm stage**
- **Modes:** bars · ring · wave · bloom (simulated spectrum, no mic)
- **Honesty:** Browser caps disclosed (dpr / canvas / audioCtx probe)
- **Footer lock:** `STATUS: OMNI-SOVEREIGN` + `| DEMO SHELL`

## Develop

```bash
npm install
npm run typecheck
npm run build
npm run pack   # optional deploy pack
```

## Deploy

- **Do not** deploy to `aura.vercel.app` (DEPLOYMENT_DISABLED / 402).
- Target project name: **`aura-3xtrinity`** → `aura-3xtrinity.vercel.app`
- Prior TW hub (reference only): `trinitywayve-aura.vercel.app`

## License

MIT — see `LICENSE`.
