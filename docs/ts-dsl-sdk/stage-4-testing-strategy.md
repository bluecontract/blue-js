# BLUE TS DSL SDK — Stage 4 testing strategy

## Goals

Stage 4 tests must prove two things:

1. The higher-level builders generate the intended runtime-correct documents/events.
2. Those generated artifacts actually work with the current processor/runtime.

## Primary oracle

- preprocess both actual and expected nodes
- compare canonical `official` JSON
- compare BlueIds when useful
- use YAML fixtures for readability, not as the primary comparison oracle

## Required suites

### 1. Parity suites
Create or extend suites for:
- access builder parity
- linked-access builder parity
- agency builder parity
- related step/helper parity

### 2. Runtime suites
Create or extend integration suites for:
- single-document permission flow
- linked-documents permission flow
- worker-agency flow
- one composition/regression scenario involving Stage 3 foundations

### 3. Guardrail suites
Add focused tests for:
- invalid builder usage
- missing required builder fields
- deterministic contract naming and insertion
- documented deviations

## Readability rules

- test names should say what is built and what is proven
- keep fluent chains readable and indented
- add short comments only when they improve comprehension

## Documentation coupling

Keep these files updated as you implement:
- `stage-4-mapping-matrix.md`
- `stage-4-coverage-matrix.md`
- `stage-4-deviations.md`
