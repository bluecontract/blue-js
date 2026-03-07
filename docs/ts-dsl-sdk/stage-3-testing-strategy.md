# BLUE TS DSL SDK — Stage 3 testing strategy

## Test layers

### 1. Parity tests
Use Java references to reproduce stage-3-relevant scenarios.

Primary comparison:
- preprocess both actual and expected documents
- compare `official` JSON
- compare BlueIds when practical

Important:
- align event/channel/wrapper payloads to `final-dsl-sdk-mapping-reference.md`
- do not preserve outdated Java-only MyOS shapes if they conflict with the final mapping reference

### 2. Exact behavior tests
For small helper builders, add focused tests that assert the generated matcher or event payload shape without requiring a huge end-to-end scenario.

Prefer direct shape tests for:
- SDPG request helper
- subscribe-to-session helper
- call-operation request helper
- matcher helper payload blocks

### 3. Processor integration tests
Use `@blue-labs/document-processor` through public package APIs only.

At minimum prove:
- admin-delivered events are re-emitted through the standard admin update flow
- subscription update handlers filter correctly by `subscriptionId`
- response-oriented matchers trigger only for the intended MyOS response shape
- a non-admin document can still participate in a session-interaction flow when `myOsAdmin(...)` is present

## Baseline protection

Before Stage 3 work:
- run the existing stage-1/stage-2 verification suite

After Stage 3 work:
- rerun the same suite
- add stage-3 tests to it

## Fixture style

- expected fixtures may be written as readable YAML documents
- canonical `official` JSON after preprocess is the primary assertion layer
- avoid snapshot-only testing

## Readability standard

Tests should read like executable cookbook examples:
- what document is being built
- what mapping shape it should produce
- what runtime behavior it should exhibit

## Deviation discipline

Any mismatch between:
- Java POC,
- final mapping reference,
- runtime behavior,

must be resolved explicitly in this order:
1. final mapping reference
2. runtime-confirmed behavior
3. Java POC only as secondary parity input

If a mismatch remains, record it in `stage-3-deviations.md` and pin it with a regression test.
