# ADR-001: Patch vulnerable Vite dependency entries

Status: accepted and implemented by the coordinator.

## Context

The root and nested mirror lockfiles were identical and each reported high-severity advisories for Vite 8.2.2 and source-map-js 1.2.1. The patched releases verified in the GitHub Advisory Database are Vite 8.2.4 and source-map-js 1.2.2.

- [Vite advisory GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw)
- [Vite Windows launch-editor advisory GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv)
- [source-map-js advisory GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)

## Decision

Update only the Vite and source-map-js package records in both lockfiles to the published patched versions, with their registry tarball URLs, integrity hashes, and license metadata. Vite 8.2.4 preserves the dependency ranges recorded by the existing Vite entry and satisfies the manifest range `^8.2.2`. Keep package manifests and unrelated dependency versions unchanged.

An attempted lock-only update selected unrelated later versions across the build toolchain; it was reverted before commit. The accepted change is the two-package patch above. No package was added.

## Validation

`npm audit --package-lock-only --json` reports zero vulnerabilities for both the root and nested lockfiles after the patch. The files remain byte-identical. Node 22 CI is the supported validation path for install, tests, typecheck, and build because the local host only has Node 24.

## Consequences

The vulnerable versions are removed without refreshing unrelated packages. The root and mirror lockfiles must remain synchronized. CI on the Wave 2 integration branch and its Draft PR target validates the complete change.
