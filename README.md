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
npm ci
npm run typecheck
npm run build
npm run pack   # optional deploy pack
```

## KRATT PRIME host runtime

The additive Node host runtime lives under `packages/kratt-runtime/`; it is separate from the AURA browser app. It binds to loopback, exposes health/readiness only, and keeps repository and worker adapters read-only/dry-run. See [the v1 runtime contract](docs/runtime/KERNEL-FIRST-EVIDENCE-RUNTIME-V1.md).

```bash
npm run runtime
npm run lint
npm test
```

## Deploy

- **Do not** deploy to `aura.vercel.app` (DEPLOYMENT_DISABLED / 402).
- Target project name: **`aura-3xtrinity`** → `aura-3xtrinity.vercel.app`
- Prior TW hub (reference only): `trinitywayve-aura.vercel.app`

## License

MIT — see `LICENSE`.
