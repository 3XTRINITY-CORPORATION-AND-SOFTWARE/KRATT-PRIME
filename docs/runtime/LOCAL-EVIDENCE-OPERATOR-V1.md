# Local Evidence Operator Surface v1

## Scope

This stage adds a local CLI for `serve`, `verify`, and explicit `index` operations, plus read-only HTTP routes for health and evidence inspection. The server refuses non-loopback bind addresses. The HTTP API implements GET only, has no CORS allowance, limits evidence pages to 100 cards, and returns a projection that omits actor identifiers and file-path metadata.

The API does not start indexing, mutate branches, dispatch workers, contact remotes, or return source file contents. A local machine process can still call loopback routes; loopback is not treated as user identity or authorization.

## CLI

```text
npm run runtime -- serve
npm run runtime -- verify --journal <absolute-path>
npm run runtime -- index --repo <absolute-path> --revision <40-char-commit-sha> --journal <absolute-path> --root-id <id> --root-statement <text> --branch-id <id> --question <text> --actor-id <id> --occurred-at <UTC-time>
```

Indexing is a deliberate local journal write and requires all inputs, including an explicit timestamp. Repeating a partial operation requires the same root, branch, actor, time and revision so event IDs and content remain identical. Exit code `2` means some cards persisted before a later append failed; rerun the same command to resume idempotently.

`verify` and the HTTP endpoints are read-only. The local journal's parent directory is created only by the first append, not by verification or inspection. Set optional `KRATT_JOURNAL_PATH` to an absolute path to expose a journal to the HTTP reader.

## HTTP routes

- `GET /health/live`
- `GET /health/ready`
- `GET /evidence/verify`
- `GET /evidence?after=0&limit=50`
- `GET /leases/status`

All other methods are rejected. The evidence listing returns card and source digests, not raw metadata, file paths, actor IDs or repository content. Without a configured journal path, evidence routes are unavailable. A configured path that does not exist is read as an empty journal; inspection does not create the file or its parent directory. The first explicit `index` append creates it.

`GET /leases/status` is available only when `KRATT_LEASE_JOURNAL_PATH` names an absolute local PrimeStore journal. It reports aggregate reservation and lease counts plus the journal-operation count. It never returns reservation keys, owner IDs, task digests, fencing numbers, or expiry times. Readiness includes the lease journal's integrity check when configured. This API has no authentication beyond loopback binding, and the lease journal is not encrypted.

## Verification and limits

The operator test suite exercises CLI validation and a full temporary local Git to ECK to journal flow, idempotent replay, safe evidence API projection, pagination bounds, and loopback-only binding. This remains a local reference operator surface: there is no user authentication, multi-user isolation, encryption, remote sync or multi-process journal coordination. Do not expose it beyond the local host.


