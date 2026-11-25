# Schema compatibility

## Current rule

The current wire contract is `1.0.0`. Validators accept only that exact `schema_version` and reject unknown fields. `isCompatibleWave2Version` reports whether a version is in major/minor family `1.0`; callers must still pass each message through the exact current validator.

## Change rules

- Patch: correction that leaves serialized fields, accepted values, bounds, and semantics unchanged. It remains in the same `1.0` family.
- Minor: additive optional field or additive enum value only when old readers are proven to ignore it safely. Because current validators reject unknown fields, a minor contract change also requires a coordinated validator release before producers emit it.
- Major: removed/renamed/required fields, changed meaning, relaxed a privacy or authorization invariant, changed event ordering guarantees, or changed error semantics.

Unknown critical fields are never silently ignored. A producer must not send a newer shape to a consumer that has not declared support. Shared-contract changes after freeze require coordinator review, compatibility fixtures, updates to every workstream, and a new recorded contract commit. No workstream may locally fork this module.

## Compatibility checks

Tests must cover the current version, unsupported major/minor versions, unknown keys, required fields, and privacy/security invariants. Examples are fixtures and must validate against the released module. A successful shape check is not a policy decision or source verification.
