# BLUE TS DSL SDK — High-Level Implementation Plan

## Objective
Build a TypeScript BLUE DSL SDK that is behaviorally close to the Java SDK and can generate valid BLUE documents that also pass runtime validation through the current public TypeScript document processor.

## Source-of-truth model
For this project, use a dual-source model:
- **Java-first for API and mapping intent**: Java docs, Java builders, and Java tests under `references/java-sdk/**` define the intended stage-1 builder surface and mapping behavior.
- **Runtime-gated for executability**: the current public TypeScript runtime (`libs/language`, `libs/document-processor`) is the final execution gate.

This means:
- do not invent a TS-native redesign for stage 1,
- do not drift from Java unless runtime forces it,
- and do not “fake Java parity” if the resulting document does not actually work with the current TS runtime.

Any proven mismatch must be documented in `stage-1-deviations.md` and locked by tests.

## Guiding principles
- **Parity before breadth**: implement a narrow, production-meaningful slice with strong tests before widening the API.
- **TypeScript adaptation, not redesign**: preserve the Java mental model where practical, but adapt overloads and type inputs naturally for TS.
- **New package boundary**: the authoring DSL belongs in a new `libs/sdk-dsl` library, not inside `language` or `document-processor`.
- **Runtime independence**: `sdk-dsl` must not depend on `document-processor` at runtime.
- **Minimal invasiveness**: avoid unrelated workspace changes and dependency upgrades.
- **Tests define done**: Java-derived parity tests, guardrail tests, and runtime integration tests are mandatory.

## Stage breakdown

### Stage 1 — Core document authoring DSL
This is the implementation target now.

Scope:
- `DocBuilder.doc/edit/from/expr`
- document identity and type
- field writes and field builder basics
- channels and composite channels
- sections and section tracking
- operations and operation builder
- minimal `StepsBuilder` needed for operation implementations
- parity harness
- counter integration test using `document-processor`

### Stage 2 — Workflow entry points and richer steps
Planned next, but out of scope now:
- `onInit`, `onEvent`, `onNamedEvent`, `onDocChange`, `onChannelEvent`
- richer `StepsBuilder` parity
- workflow handler mapping expansion

### Stage 3 — Interactions / MyOS DSL
Planned later:
- MyOS helpers
- access
- linked access
- agency
- generated workflow conventions and deterministic keys

### Stage 4 — AI DSL
Planned later:
- AI integration builders
- task-oriented steps and response handlers

### Stage 5 — PayNote DSL and mapping definitions
Planned later:
- PayNote-specific builders
- mappings derived from demo-bank-app and later mapping work
- conversation/customer-action-related mappings

### Stage 6 — Optional editing pipeline
Planned only after authoring DSL is stable:
- structure extraction
- DSL generator
- stub generator
- change request compiler
- patch-set support

## Stage-1 implementation strategy
1. **Create the package and docs**
   - create `libs/sdk-dsl`
   - align package/config files with the monorepo
   - keep stage-1 docs accurate from the start

2. **Implement a small internal kernel first**
   - type input resolution
   - supported value-to-node conversion
   - pointer write/remove helpers
   - contracts helper
   - section tracker
   - operation builder state

3. **Implement the public stage-1 API**
   - `DocBuilder`
   - field builder
   - operation builder
   - minimal `StepsBuilder`

4. **Build parity harness + tests**
   - port stage-1-relevant Java tests as closely as possible
   - compare canonical Blue trees after preprocess
   - add direct unit tests for helpers

5. **Build runtime harness + integration test**
   - use public APIs only
   - configure the processor registry consistently with current repo patterns
   - prove the counter document works end-to-end

## Quality bar for every stage
A stage is not complete until:
1. implemented features are documented
2. mapping matrix is updated
3. coverage matrix is updated
4. deviations are recorded if needed
5. parity and guardrail tests are green
6. runtime integration tests for representative flows are green

## Stage-1 success condition
A new `libs/sdk-dsl` package exists, exports the stage-1 authoring API, produces correct BLUE document structures for the covered cases, and passes:
- Java-derived parity tests
- guardrail tests
- counter runtime integration test
- required typecheck/lint/build commands
