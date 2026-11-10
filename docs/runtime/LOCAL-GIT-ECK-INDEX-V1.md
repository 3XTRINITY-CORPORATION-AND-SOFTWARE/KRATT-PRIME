# Local Git ECK Index Adapter v1

## Scope

`createLocalGitRepositorySource` implements the read side of the repository adapter contract. It reads an already-present local Git object database at a caller-selected immutable 40-character commit SHA, then composes with `createReadOnlyRepositoryIndexer` to produce path, blob SHA, content digest, and byte length metadata. `createRepositoryEvidenceCards` turns that metadata into typed ECK `OBSERVED` cards bound to the root claim, branch, actor, source revision, and content digest. The index result does not retain or return source text.

The adapter invokes only fixed `git ls-tree` and `git cat-file` argument forms through `spawnSync` with `shell: false`. It never reads a remote URL, invokes checkout/hooks, writes the repository, updates refs, or sends content outside the process. Caller-provided remotes are not used. Output, blob size, and execution time have conservative configurable caps.

## Guardrails

- Only full lowercase commit SHA values are accepted; symbolic names such as `HEAD`, branch names, and revision expressions are rejected.
- Blobs must be regular Git files and belong to the exact tree previously read for the same revision.
- Symlink entries, unsafe paths, and malformed blob requests are rejected or skipped.
- The downstream indexer excludes secret-like paths and enforces aggregate file and byte limits.
- File bytes must be valid UTF-8. Binary blobs are not indexed in this increment.
- The source exposes read methods only. The adapter reports `LOCAL_READ_ONLY` and `externalTransfer: false` as contract metadata, not as a system-wide network audit.

## Known limits / ADR follow-up

- This adapter trusts the selected local repository directory and Git executable supplied by the host environment. Production composition must provide a trusted absolute path and executable policy, and decide how to treat Git's safe-directory configuration.
- Git object SHA-1 is an identifier, not a signature or proof of author identity. Commit authenticity, repository ownership, licensing and secret scanning need separate policy and evidence.
- The source cannot prove that the local object database has no configured replacement refs or grafts. A hardened production mode should disable/inspect replacement objects and validate object format.
- The current synchronous Git calls are bounded but block the event loop briefly; high concurrency should use a worker pool with admission limits.
- UTF-8-only indexing, secret-path matching, file-count limits, and metadata retention require validation against representative repositories before production use.
- No MCU source/build, statistical calibration, remote GitHub indexing, or autonomous evidence acceptance is implemented here.

## Verification

`packages/kratt-runtime/test/local-git-source.test.mjs` creates an isolated temporary Git repository and checks pinned-tree reads, path/blob binding, non-symbolic revision enforcement, shell-free invocation, output bounds, composition with the metadata-only indexer, and ECK branch provenance. It performs no network operation and removes the temporary fixture after each case.

