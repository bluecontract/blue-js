# Explicit exclusions from the canonical scenario corpus

These scenarios can still be valuable, but they are not part of the canonical corpus for DSL-authored document generation.

## Transport and query behavior

Exclude:
- REST/API transport suites
- endpoint contract tests
- query and projection tests

Reason:
- they validate transport or read-model behavior, not authored document generation from the DSL.

## `initMode` / `LATE_START`

Exclude:
- scenarios whose primary assertion is `initMode`
- late-start-only branches

Reason:
- `initMode` / `LATE_START` are backend/runtime concerns outside the core DSL document-authoring boundary.

## Bootstrap endpoint status flows

Exclude as canonical acceptance:
- bootstrap endpoint status behavior
- bootstrap transport contracts

Reason:
- bootstrap endpoint/status behavior is not the same thing as authored-document generation.
- bootstrap request events remain in scope elsewhere through worker-session and paynote scenarios.

## Persistence and idempotency semantics

Exclude as acceptance suites:
- persistence-focused or idempotency-focused tests whose assertions do not change authored document shape

Reason:
- these tests validate runtime storage guarantees.
- compact authored document blueprints can still be included as canonical seed documents.

## Deferred DSL surfaces

Exclude for now:
- scenario families that require a dedicated DSL surface not yet exposed publicly

Reason:
- they remain valid future additions, but should not become hard acceptance gates until the DSL surface exists.

## Outward API handlers and utility layers

Exclude:
- external API handler suites
- validation-only tests
- parsing-only utility tests

Reason:
- these layers do not define or validate authored BLUE document structure through runtime flows.
