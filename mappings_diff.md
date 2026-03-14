# DSL Mapping Differences (Java POC → TypeScript SDK)

This document tracks parity/adaptation differences between the Java DSL POC and the TypeScript SDK implemented in this repository.

## Source references

- Java DSL parity tests:
  - `DocBuilderGeneralDslParityTest`
  - `DocBuilderChannelsDslParityTest`
  - `DocBuilderOperationsDslParityTest`
  - `DocBuilderStepsDslParityTest`
  - `DocBuilderMyOsDslParityTest`
  - `DocBuilderInteractionsDslParityTest`
- Java mapping docs:
  - `docs/sdk-dsl-mapping-audit-reference.md`
  - `docs/sdk-dsl-mapping-reference.md`

## Mapping status

| Area | Java POC behavior | TypeScript SDK behavior | Status |
| --- | --- | --- | --- |
| Basic scalar types | Java accepts class aliases (`Integer.class`, etc.) | TS exports `BasicBlueTypes` (`Text`, `Integer`, `Double`, `Boolean`, `List`, `Dictionary`) and accepts string aliases in all builder APIs | Resolved |
| Expression helper | `DocBuilder.expr(...)` wraps `${...}` only when needed | `expr(...)` function and `DocBuilder.expr` static alias with same behavior | Resolved |
| Channel defaults | Java parity fixtures often default to `Core/Channel` | TS `.channel(...)` defaults to `Core/Channel`; explicit MyOS timeline channels still supported via config | Resolved |
| Zod typed request/channel support | Java uses class/bean typing | TS resolves Zod schemas using `withTypeBlueId(...)` / `getTypeBlueIdAnnotation(...)`; fallback to alias strings and `{ blueId }` objects | Resolved |
| Operation workflows | Java supports inline + builder operation styles | TS supports both overload-driven inline setup and fluent `operation(...).done()` builders | Resolved |
| Change lifecycle helpers | Java POC direct/propose/accept/reject change helpers | TS emits `Conversation/Change*` / `Propose*` / `Accept*` / `Reject*` operation+workflow contracts and includes `request.type: Conversation/Change Request` for runtime matcher compatibility | Adapted (schema-driven) |
| Contracts policy | Java parity used policy-style section in some fixtures | TS emits `Conversation/Contracts Change Policy` as contract marker (`contractsPolicy(...)`) | Adapted |
| Document section tracking | Java tracks related fields/contracts | TS section context tracks builder-touched pointers/contracts and emits `Conversation/Document Section` on `endSection()` (or before output) | Resolved |
| MyOS anchors/links wrappers | Java exposes wrappers for anchors/links | TS provides `documentAnchors(...)` and `documentLinks(...)` wrappers that emit `MyOS/Document Anchors` and `MyOS/Document Links` | Resolved |
| Participants field naming | Older Java examples use `channelKey` in participant events | TS aligns with current repository schema field `channelName` for add/remove participant events | Adapted (schema-driven) |
| Worker agency permission field naming | Older Java examples use `workerAgencyPermissions` | TS aligns with current schema field `allowedWorkerAgencyPermissions` | Adapted (schema-driven) |
| Named event aliasing | Java examples use `Common/Named Event` | TS emits `Conversation/Event` for named events to satisfy current repository type resolution/runtime expectations | Adapted (runtime compatibility) |
| E2E registration of section/policy marker contracts | Java engine accepted marker-like additions in context | TS runtime helper explicitly registers marker processors for `Conversation/Document Section` and `Conversation/Contracts Change Policy` when constructing the processor | Adapted (runtime setup) |

## Explicit non-parity / out-of-scope in this implementation

The Java POC contains broader DSL modules (e.g., full payment rail helpers, complete access/linked-access/agency nested builders).  
This TS implementation focuses on the required mechanism set from the request and provides generic step/event building primitives to cover those scenarios.

These modules are intentionally deferred:

- Full payment request rail-specific fluent builders
- Full interaction/access/linked-access/agency nested DSL trees
- PayNote-specific DSL package parity

Status: **Intentionally deferred**

