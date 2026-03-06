# Blue Document Creation & Editing Pipeline — Developer Guide

## Overview

Blue documents are created and edited through a Java DSL. An LLM generates DSL code, the system compiles it to a Node, and a deterministic compiler produces changeRequests for the platform. The DSL text is stored alongside the Node so that future edits have full context.

There are three modes of operation:
1. **Creation** — LLM generates full DSL from scratch
2. **Edit with stored DSL** — LLM sees the exact DSL that built the current document
3. **Edit without stored DSL** — LLM sees a generated stub DSL + the full document JSON

All three modes produce the same output format: a Node and a changeRequest.

---

## Mode 1: Document Creation

### What the LLM receives

- User's natural language request
- DSL reference documentation (DocBuilder API, PayNoteBuilder API, step types)
- Available type classes (Agent, Channel types, event types)

### What the LLM outputs

Full DSL code that builds the document from scratch:

```java
DocBuilder.doc()
    .name("Counter")
    .description("Simple counter with increment operation for owner.")
    .section("participants", "Participants", "Document owner")
        .channel("ownerChannel")
    .endSection()
    .section("counterOps", "Counter", "Owner can increment counter by one.")
        .field("/counter", 0)
        .operation("incrementByOne")
            .channel("ownerChannel")
            .description("Increment counter by one")
            .noRequest()
            .steps(steps -> steps
                .replaceExpression("Inc", "/counter", "document('/counter') + 1"))
            .done()
    .endSection()
    .buildDocument();
```

### What the system does

1. Execute the DSL → produces a `Node`
2. Generate storable DSL text: `DslGenerator.generate(node)` → store in DB alongside the Node

### Key rules for creation DSL

- Always start with `DocBuilder.doc()` (or `PayNotes.payNote()` for PayNotes)
- Always end with `.buildDocument()`
- Group related contracts and fields into `.section(key, title, summary)...endSection()` blocks
- Every channel, operation, and field added within a section block is automatically tracked in that section's `relatedContracts` / `relatedFields`
- Use `.myOsAdmin(channelKey)` for MyOS admin boilerplate instead of manually creating the operation + impl
- Use `.onInit()`, `.onDocChange()`, `.onEvent()`, `.onMyOsResponse()`, `.onSubscriptionUpdate()` for workflow patterns
- For PayNotes, use `.capture()`, `.reserve()`, `.release()` action builders

---

## Mode 2: Edit with Stored DSL

### What the LLM receives

- User's edit request
- The **stored DSL text** (exactly what was generated after the last edit or creation)
- DSL reference documentation

### Example: stored DSL the LLM sees

```java
DocBuilder.doc()
    .name("Counter")
    .description("Simple counter with increment operation for owner.")
    .section("participants", "Participants", "Document owner")
        .channel("ownerChannel")
    .endSection()
    .section("counterOps", "Counter", "Owner can increment counter by one.")
        .field("/counter", 0)
        .operation("incrementByOne")
            .channel("ownerChannel")
            .description("Increment counter by one")
            .noRequest()
            .steps(steps -> steps
                .replaceExpression("Inc", "/counter", "document('/counter') + 1"))
            .done()
    .endSection()
    .buildDocument();
```

### What the LLM outputs

Edit DSL that starts with `DocBuilder.from(currentNode)` and applies only the changes:

```java
DocBuilder.from(currentNode)
    .description("Simple counter with increment and decrement operations for owner.")
    .section("counterOps")
        .operation("decrementByOne")
            .channel("ownerChannel")
            .description("Decrement counter by one")
            .noRequest()
            .steps(steps -> steps
                .replaceExpression("Dec", "/counter", "document('/counter') - 1"))
            .done()
    .endSection()
    .buildDocument();
```

### What the system does

1. Execute the edit DSL against the current Node → produces a new Node
2. Compile changeRequest: `ChangeRequestCompiler.compile(beforeNode, afterNode)`
   - Root field changes go into `changeset` (never contains `/contracts` paths)
   - Contract changes go into `sectionChanges` (add/modify/remove)
   - Modified sections include ALL their contracts, not just changed ones
   - Section assignment is deterministic based on existing section membership
3. Regenerate storable DSL: `DslGenerator.generate(afterNode)` → update stored DSL in DB
4. Send changeRequest to the platform

### Key rules for edit DSL

- Always start with `DocBuilder.from(currentNode)` (not `DocBuilder.doc()`)
- Always end with `.buildDocument()`
- Only include what's CHANGING — unchanged operations, channels, and fields are preserved automatically
- To add to an existing section, use `.section("existingKey")` (single arg, no title/summary) — this opens the section for additions without modifying its metadata
- To add a new section, use `.section("newKey", "Title", "Summary")`
- Root field changes: `.replace("/path", newValue)` or `.remove("/path")` (and `.field("/path", value)` for set-like behavior)
- The LLM does NOT need to reproduce unchanged contracts, manage section metadata, or worry about changeRequest format — the system handles all of that

---

## Mode 3: Edit without Stored DSL

This is the fallback when the stored DSL is missing (document was created through a different system, imported, or DSL was lost).

### What the LLM receives

- User's edit request
- A **stub DSL** generated from the Node: `DslStubGenerator.generate(node)`
- The **full document JSON** (so the LLM can see implementation details)
- DSL reference documentation

### Example: stub DSL the LLM sees

```java
DocBuilder.doc()
    .name("Counter")
    .description("Simple counter with increment operation for owner.")
    .section("participants", "Participants", "Document owner")
        .channel("ownerChannel")
    .endSection()
    .section("counterOps", "Counter", "Owner can increment counter by one.")
        .field("/counter", 0)
        .operation("incrementByOne")
            .channel("ownerChannel")
            .description("Increment counter by one")
            .noRequest()
            // implementation in document JSON
            .done()
    .endSection()
    .buildDocument();
```

The stub shows:
- Document metadata (name, description, type)
- Section structure with titles and summaries
- Channel keys
- Operation signatures (key, channel, description, request type)
- Field paths and values

The stub does NOT show:
- Workflow step implementations
- JavaScript code
- Expression details
- Complex nested event payloads

The LLM reads step implementations from the full document JSON when needed.

### What the LLM outputs

The **exact same format** as Mode 2:

```java
DocBuilder.from(currentNode)
    .description("Simple counter with increment and decrement operations for owner.")
    .section("counterOps")
        .operation("decrementByOne")
            .channel("ownerChannel")
            .description("Decrement counter by one")
            .noRequest()
            .steps(steps -> steps
                .replaceExpression("Dec", "/counter", "document('/counter') - 1"))
            .done()
    .endSection()
    .buildDocument();
```

### What the system does

Same as Mode 2, plus: the regenerated DSL becomes the first stored DSL for future edits. From this point forward, the document has stored DSL and future edits use Mode 2.

---

## Component Reference

### DocBuilder

Base builder for any Blue document. Provides:

| Method | Purpose |
|---|---|
| `DocBuilder.doc()` | Start new document |
| `DocBuilder.from(node)` | Start edit of existing document (clones) |
| `DocBuilder.edit(node)` | Start edit of existing document (mutates provided node) |
| `.name(s)`, `.description(s)`, `.type(cls)` | Document metadata |
| `.section(key, title, summary)` | Open new section |
| `.section(key)` | Open existing section (for edits) |
| `.endSection()` | Close section |
| `.channel(key)` | Add timeline channel |
| `.channels(keys...)` | Add multiple channels |
| `.compositeChannel(key, children...)` | Add composite channel |
| `.myOsAdmin(channelKey)` | Add MyOS admin boilerplate |
| `.operation(key).channel().description().steps().done()` | Add operation with builder |
| `.directChange(key, channel, description)` | Add direct change operation |
| `.field(path, value)` | Set field and track in active section |
| `.field(path)` | Start field builder (type/description/constraints/value) |
| `.replace(path, value)` | Replace field value |
| `.remove(path)` | Remove field |
| `.onInit(key, steps)` | Workflow on document init |
| `.onDocChange(key, path, steps)` | Workflow on document path change |
| `.onEvent(key, eventClass, steps)` | Workflow on triggered event |
| `.onMyOsResponse(key, responseClass, requestId, steps)` | Workflow on MyOS response |
| `.onSubscriptionUpdate(key, subId, updateClass, steps)` | Workflow on subscription update |
| `.buildDocument()` | Build the Node |

Note: `.set(path, value)` exists as internal/protected API. Public authoring should use `.field(...)`.

### PayNoteBuilder

Extends DocBuilder for PayNote documents. Adds:

| Method | Purpose |
|---|---|
| `PayNotes.payNote(name)` | Start PayNote |
| `.currency(iso)` | Set currency |
| `.amountMinor(cents)` / `.amountMajor(str)` | Set amount |
| `.capture().lockOnInit().unlockOnOperation().done()` | Capture flow |
| `.reserve().requestOnInit().done()` | Reserve flow |
| `.release().requestOnOperation().done()` | Release flow |

### DslGenerator

Generates full, readable DSL text from any Node. Used for storage after creation and edits.

```java
String dsl = DslGenerator.generate(node);
// Store dsl in DB alongside the node
```

The output includes section blocks, full operation signatures with step implementations, workflow patterns collapsed to shortcut methods (`.onInit()`, `.myOsAdmin()`, etc.), and PayNote action builders where applicable.

### DslStubGenerator

Generates stub DSL from any Node. Used as fallback when stored DSL is missing.

```java
String stub = DslStubGenerator.generate(node);
// Show stub + document JSON to LLM
```

Same structure as DslGenerator output but with step implementations replaced by `// implementation in document JSON` comments.

### ChangeRequestCompiler

Deterministic compiler that diffs two Nodes and produces a changeRequest.

```java
Node changeRequest = ChangeRequestCompiler.compile(beforeNode, afterNode);
```

Output structure:
- `changeset`: JSON Patch entries for root fields (never contains `/contracts` paths)
- `sectionChanges.add`: new sections with their contracts
- `sectionChanges.modify`: changed sections with ALL their contracts (changed + unchanged)
- `sectionChanges.remove`: removed section keys

### DocStructure

Internal analysis layer used by DslGenerator and DslStubGenerator. Extracts contract kinds, section groupings, operation signatures from any Node.

```java
DocStructure structure = DocStructure.from(node);
// structure.contracts — all contracts by key with kind, channel, etc.
// structure.sections — all sections with related fields/contracts
// structure.rootFields — all non-reserved root fields
```

---

## Lifecycle Summary

```
CREATE:
  User request
    → LLM generates full DSL
    → System executes → Node
    → DslGenerator.generate(Node) → stored DSL
    → ChangeRequestCompiler.compile(empty, Node) → changeRequest
    → Platform applies changeRequest

EDIT (stored DSL exists):
  User request + stored DSL
    → LLM generates edit DSL (DocBuilder.from)
    → System executes against current Node → new Node
    → ChangeRequestCompiler.compile(old, new) → changeRequest
    → DslGenerator.generate(new Node) → updated stored DSL
    → Platform applies changeRequest

EDIT (no stored DSL):
  User request + DslStubGenerator.generate(Node) + document JSON
    → LLM generates edit DSL (DocBuilder.from) — same format
    → System executes against current Node → new Node
    → ChangeRequestCompiler.compile(old, new) → changeRequest
    → DslGenerator.generate(new Node) → stored DSL (first time)
    → Platform applies changeRequest
```

---

## Reference Test

`CounterCreationAndEditPipelineTest` demonstrates the complete flow. Key methods:

- `createCounterViaLlmDsl()` — what LLM generates for creation (Mode 1)
- `applyDecrementEdit(node)` — what LLM generates for edit (Mode 2/3)
- `creationProducesValidDocumentAndStorableDsl` — proves creation → storage → changeRequest
- `editWithStoredDslProducesCorrectChangeRequest` — proves edit → changeRequest → roundtrip → regeneration
- `editWithStubDslProducesSameResultAsStoredDslPath` — proves stub path equals stored DSL path
- `fullLifecycleFromCreationThroughStoredAndStubEdits` — walks through all three modes in one test

