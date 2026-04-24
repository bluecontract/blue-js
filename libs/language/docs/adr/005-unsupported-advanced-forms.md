# ADR-005: Unsupported Advanced Forms In Milestone 1

## Status

Accepted for Phase 0.

## Context

The specification gives special semantics to direct cycles through `this#` and
to list control forms `$pos`, `$previous`, and `$empty`. Treating deferred forms
as ordinary object content would produce stable but wrong identities.

## Decision

Milestone 1 supports `$empty` as content because it affects BlueId and is part
of the single-document identity work. Milestone 1 does not support:

- `this#`
- `$pos`
- `$previous`

Phase A must fail fast for these unsupported forms in BlueId/minimize paths.

## Consequences

Deferred features are visible and safe. The system should throw an unsupported
feature error for `this#`, `$pos`, and `$previous` instead of silently hashing
them as ordinary document content.
