# Document processor engine lifecycle (Java parity track)

This document summarizes the Java document-processing lifecycle and key parity behaviors.

## Initialization flow

1. `DocumentProcessor#initializeDocument(document)`
2. `ProcessorEngine.initializeDocument(...)`
3. `ScopeExecutor.loadBundles("/")`
4. `ContractLoader.load(scopeNode, scopePath)`
   - contract key normalization
   - built-in + registry processor resolution
   - handler channel derivation
   - composite timeline cycle validation
5. Initialization marker/checkpoint setup
6. Root lifecycle emissions recorded in runtime

Lifecycle event shape notes:

- Initialization lifecycle event carries:
  - `type` property value: `"Core/Document Processing Initiated"`
  - semantic root node type metadata: `type.blueId = "Core/Document Processing Initiated"`
- Termination lifecycle event carries:
  - `type` property value: `"Core/Document Processing Terminated"`
  - semantic root node type metadata: `type.blueId = "Core/Document Processing Terminated"`

This keeps value-based checks aligned with JS fixture expectations while enabling semantic event filters (`event.type.blueId`) during initialization/termination workflows.

## External event flow

1. `DocumentProcessor#processDocument(document, event)`
2. `ProcessorEngine.processDocument(...)`
3. `ScopeExecutor.processExternalEvent(scopePath, event)`
4. For each channel binding:
   - `ProcessorEngine.evaluateChannel(...)`
   - channel `evaluate(...)` may return:
     - single event
     - multi-delivery set (composite channels)
5. `ChannelRunner` duplicate/recency checks
   - checkpoint signature check
   - `isNewerEvent(...)` gate
6. Handler dispatch with `HandlerProcessor.matches(...)`
7. Patches/events applied via `ProcessorExecutionContext`

## Patch and cascade semantics

Patch application route:

- `ProcessorExecutionContext#applyPatch`
- `ScopeExecutor#handlePatch`
- boundary + reserved-key protection
- `DocumentProcessingRuntime#applyPatch`
- document update cascade to matching `DocumentUpdateChannel` handlers

Boundary violations trigger fatal termination for the scope.

## Embedded scope routing

`ProcessEmbedded` markers define embedded child scope pointers.

Execution guarantees:

- embedded children loaded and routed by normalized pointers
- parent cannot mutate embedded interior (boundary protection)
- removing embedded root cuts off child scope work for the run

## Termination semantics

- Graceful and fatal terminations are recorded per scope.
- Root fatal parity behavior:
  - emits only the `"Document Processing Terminated"` lifecycle event.
  - no extra `"Document Processing Fatal Error"` outbox emission.

## Checkpointing semantics

Checkpoint marker: `ChannelEventCheckpoint`.

Stored by channel key:

- `lastEvents[channelKey]`
- `lastSignatures[channelKey]`

Composite deliveries use namespaced keys:

- `compositeKey::childKey`

This allows independent dedupe/recency tracking per child delivery.

## Gas accounting touchpoints

Core charges include:

- scope/channel/handler overhead
- patch operations
- event emission/drain
- trigger/update step bases
- document snapshot reads
- wasm gas conversion charges for QuickJS execution

