# Recommendations: `paynote2` -> Runtime SDK (Updated)

## Decision Summary
1. Runtime SDK package root should be `blue.language.sdk` (generic), not `blue.language.paynote.sdk`.
2. `paynote2` SDK must move from `src/test/java` to `src/main/java`.
3. Standard `@TypeBlueId` wrappers must move out of `samples.paynote` into `src/main/java/blue/language/types/*`.
4. Standard types should be split into separate classes (not large nested `*Types` containers).
5. Type wrappers should support fluent authoring (`.a(...).b(...)`) or standard setters + dedicated builders.
6. Preferred: move minimal required DSL internals to `src/main/java/blue/language/sdk/internal/...`.

---

## 1) Target Runtime Package Layout

Use `blue.language.sdk` as the runtime root.

Recommended structure:
- `blue.language.sdk`
  - `DocBuilder`
  - `SimpleDocBuilder`
  - `MyOsSteps`
  - `MyOsPermissions`
  - extension entrypoints (e.g., `ext(...)`, namespace shortcuts)
- `blue.language.sdk.paynote` (domain module under SDK root)
  - `PayNoteBuilder`
  - `PayNotes`
- `blue.language.sdk.internal`
  - moved internal helpers currently taken from sample DSL (`ContractsBuilder`, `PoliciesBuilder`, relevant parts of `StepsBuilder`, type/ref helpers)

Important: `blue.language.sdk.*` must not import anything from `blue.language.samples.*`.

---

## 2) Move Standard Types to Main, Split Per Type

Current issue:
- standard wrappers are in `src/test/java/blue/language/samples/paynote/types/*` and grouped as nested classes (`CoreTypes`, `ConversationTypes`, `MyOsTypes`, `PayNoteTypes`, `CommonTypes`).

Target:
- `src/main/java/blue/language/types/core/*`
- `src/main/java/blue/language/types/conversation/*`
- `src/main/java/blue/language/types/myos/*`
- `src/main/java/blue/language/types/paynote/*`
- `src/main/java/blue/language/types/common/*`

Each logical type should become its own class file.

Examples:
- `blue.language.types.core.DocumentUpdate`
- `blue.language.types.conversation.Operation`
- `blue.language.types.myos.CallOperationRequested`
- `blue.language.types.paynote.CaptureFundsRequested`
- `blue.language.types.common.NamedEvent`

Keep sample/demo-only domain events in test scope:
- `samples.paynote.types.domain.*` can remain under `src/test/java`.

---

## 3) Type Class Authoring Style

For each generated/handwritten type wrapper, choose one of these patterns and enforce consistently:

### Preferred (DSL-friendly): Fluent setters on the class
```java
public class CallOperationRequested {
    public String onBehalfOf;
    public String operation;
    public CallOperationRequested onBehalfOf(String v) { this.onBehalfOf = v; return this; }
    public CallOperationRequested operation(String v) { this.operation = v; return this; }
}
```

### Alternative: JavaBean setters + builder companion
```java
CallOperationRequested req = CallOperationRequestedBuilder.create()
    .onBehalfOf("ownerChannel")
    .operation("provideInstructions")
    .build();
```

Recommendation: use fluent setters directly on wrapper classes for smallest API surface and best DSL ergonomics.
Decision: use fluent setters.

---

## 4) Internal DSL Extraction

`paynote2` runtime currently depends on sample DSL classes in test scope.

Preferred action:
- move minimal required internals to:
  - `src/main/java/blue/language/sdk/internal/...`

Candidate internals to move (minimal set only):
- contract assembly helpers
- policy assembly helpers
- step emission helpers needed by public builders
- type reference/alias helper used by runtime builders

Do not migrate the whole legacy sample DSL; move only what runtime SDK needs.

---

## 5) Migration Plan

### Phase 0: Guardrails first
- Add guardrail test: fail if any `src/main/java` file imports `blue.language.samples.*`.
- Add guardrail test: public runtime API lives under `blue.language.sdk*` and `blue.language.types*`.

### Phase 1: Promote `paynote2` SDK to main
- Move `paynote2/sdk/*` into `src/main/java/blue/language/sdk` (+ `blue/language/sdk/paynote` for paynote module).
- Keep behavior unchanged initially.

### Phase 2: Move standard wrappers to main (split classes)
- Move `CoreTypes`/`ConversationTypes`/`MyOsTypes`/`PayNoteTypes`/`CommonTypes` into per-type classes under `blue.language.types.*`.
- Add fluent setter methods (or builders) as chosen standard.
- Update imports in SDK and examples.

### Phase 3: Remove sample DSL coupling
- Move required internals into `blue.language.sdk.internal`.
- Replace all `samples.paynote.dsl` imports in runtime SDK.

### Phase 4: Cleanup
- Keep examples in test scope only.
- Keep only demo/domain events in sample packages.
- Mark old sample-wrapper locations deprecated, then remove.

---

## 6) Acceptance Criteria
1. Runtime builders exist in `src/main/java/blue/language/sdk*`.
2. Standard `@TypeBlueId` wrappers exist in `src/main/java/blue/language/types/*` as separate classes.
3. Runtime code has zero imports from `blue.language.samples.*`.
4. Type wrappers support fluent setters (or standardized builder companions).
5. All tests pass after migration.

---

## 7) Practical First Batch (Do Next)
1. Move `DocBuilder`, `SimpleDocBuilder`, `MyOsSteps`, `MyOsPermissions` to `blue.language.sdk` in `main`.
2. Move `PayNoteBuilder`, `PayNotes` to `blue.language.sdk.paynote` in `main`.
3. Extract and move `MyOsTypes`, `ConversationTypes`, `CoreTypes`, `PayNoteTypes`, `CommonTypes` into per-type classes under `blue.language.types.*`.
4. Implement fluent setters on moved type classes.
5. Add import guardrails to prevent regressions.
