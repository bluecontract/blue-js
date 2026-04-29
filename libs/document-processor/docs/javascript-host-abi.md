# Document Processor JavaScript Host ABI

Document JavaScript runs inside the deterministic QuickJS runtime, not in the
host Node.js process. The only document-processor capabilities exposed to
evaluated code are the globals described here.

The current ABI version is `document-processor-host-v1`.

## Globals

The evaluator exposes these globals to every script and deterministic module
pack:

```ts
event
eventCanonical
steps
document(pointer?)
document.canonical(pointer?)
emit(value)
currentContract
currentContractCanonical
```

All values crossing the QuickJS boundary must be valid deterministic values
(`DV`) under `@blue-quickjs/dv` default limits. This applies to input bindings,
`document()` return values, `document.canonical()` return values, `emit()`
payloads, and the final evaluator output.

## Default Values

When a binding is not provided:

- `event` is `null`.
- `eventCanonical` defaults to `event`.
- `steps` is an empty array.
- `currentContract` is `null`.
- `currentContractCanonical` defaults to `currentContract`.
- `document()` and `document.canonical()` return `null`.
- `emit()` is a synchronous no-op and returns `null`.

## `event` And `eventCanonical`

`event` is the regular document event value exposed to document JavaScript.
`eventCanonical` is the canonical representation of the same event.

Both values must be valid DV. If `eventCanonical` is omitted, it defaults to the
plain `event` value.

## `steps`

`steps` contains prior step results for workflow JavaScript. It must be valid DV.
When omitted, it defaults to `[]`.

## `currentContract` And `currentContractCanonical`

`currentContract` is the current contract as regular JSON/DV. In workflow step
bindings it is produced with the language layer's `simple` JSON strategy.

`currentContractCanonical` is the canonical representation of the current
contract. In workflow step bindings it is produced with the language layer's
`official` JSON strategy.

If `currentContractCanonical` is omitted, it defaults to `currentContract`.

## `document(pointer?)`

`document()` reads from the processor document and returns a regular JSON/DV
value.

Rules:

- `pointer` is optional. The step binding treats `null`/`undefined` as `/`.
- `pointer` must be a string once it reaches the document binding.
- Non-string pointers may be rejected by the lower-level QuickJS Host ABI before
  the document binding is called.
- Relative pointers are resolved by the processor execution context.
- A missing document path returns `null` to JavaScript.
- If the host document binding throws, the evaluator reports a host error.
- If the binding returns `undefined`, the evaluator returns `null`.
- If the binding returns a value that is not valid DV, the evaluator reports a
  host error.
- Async document callbacks are not supported. Returning a `Promise` is rejected
  as an invalid host value.

The document-processor step binding returns raw simple values for paths ending
in one of these segments:

```text
blueId
name
description
value
```

All other paths are converted with the regular JSON strategy.

## `document.canonical(pointer?)`

`document.canonical()` reads from the processor document and returns the
canonical JSON/DV value.

Rules are the same as `document()`. If a separate canonical callback is not
provided, the evaluator falls back to `document()`.

## `emit(value)`

`emit()` forwards a DV payload to the host emit binding.

Rules:

- `value` must be valid DV.
- Values that cannot be encoded as DV may be rejected by the lower-level QuickJS
  Host ABI before the emit binding is called.
- The host callback must be synchronous.
- Returning a `Promise` reports a host error.
- If no emit binding is provided, `emit()` is a no-op and returns `null`.
- If the host callback throws, the evaluator reports a host error.
- In processor workflows, `emit()` is available in JavaScript Code steps and in
  expression resolution for Update Document and Trigger Event steps. Expression
  emissions happen while the expression is being resolved.

## Scripts And Module Packs

The evaluator accepts two source forms:

- Script code, wrapped by the evaluator so document-authored code can use
  `return`.
- Deterministic `ModulePack.v1` artifacts passed to the QuickJS runtime as
  `ProgramArtifact.v2` with `sourceKind: "module-pack"`.

Module-pack entry modules return the selected entry export, defaulting to
`default`. Module packs are a prebuilt deterministic ESM graph surface; they do
not add runtime filesystem, network, package-manager, or dynamic import access.
The underlying runtime verifies the module pack's `graphHash` before execution.

Document workflow `${...}` expressions still use script code. Workflow steps can
use script code through `Conversation/JavaScript Code` or module-pack execution
through `Conversation/JavaScript Module Code`, which builds the module pack from
referenced `Conversation/JavaScript Module` contracts.

## Host Errors

Host errors are surfaced to JavaScript evaluation as `HostError`. Some malformed
host-call arguments are rejected by the lower-level QuickJS Host ABI before the
document-processor callback runs; those errors keep the runtime's validation
message.

Stable low-level host error codes used by the evaluator:

- `INVALID_PATH` with tag `host/invalid_path` for document callback failures,
  including invalid pointer handling performed by the binding.
- `LIMIT_EXCEEDED` with tag `host/limit` for invalid DV host values that reach
  the document-processor host callback, async callbacks, and host emit failures.

## Determinism Rules

Host callbacks are synchronous only. Any value that crosses the host boundary is
validated as DV before it is accepted. This keeps the document JavaScript API
stable even if the lower-level QuickJS runtime, Host.v1/Host.v2 ABI, execution
profiles, or artifact format evolve later.
