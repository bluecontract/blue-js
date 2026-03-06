# QuickJS integration (Java parity track)

This document describes the current Java QuickJS runtime architecture after parity migration.

## Runtime stack

- `ScriptRuntime` — Java SPI for script evaluation requests/responses.
- `QuickJsSidecarRuntime` — default implementation using a managed Node sidecar process.
- `QuickJSEvaluator` — evaluator facade that:
  - validates bindings,
  - normalizes defaults,
  - wraps code as JS function-body execution (`return ...` required for defined result),
  - maps runtime failures into `CodeBlockEvaluationError`.
- `QuickJsExpressionUtils` — expression/template traversal helpers built on top of `QuickJSEvaluator`.

## Sidecar backend

Sidecar entrypoint: `tools/quickjs-sidecar/index.js`.

Backend runtime:

- `@blue-quickjs/quickjs-runtime`
- `@blue-quickjs/abi-manifest`
- `@blue-quickjs/dv`

The sidecar no longer uses Node `vm` execution or heuristic gas estimation.

## Protocol

Line-delimited JSON over stdio.

Request:

- `id`
- `code`
- `bindings`
- `wasmGasLimit`

Response:

- `id`
- `ok`
- `resultDefined`
- `result`
- `error` (when `ok=false`)
- `wasmGasUsed`
- `wasmGasRemaining`

`QuickJsSidecarRuntime` enforces response id correlation and normalizes runtime errors into `ScriptRuntimeException`.

## Fuel / gas behavior

- Sidecar reports runtime fuel directly from quickjs runtime:
  - `gasUsed`
  - `gasRemaining`
- Java runtime surfaces those as:
  - `ScriptRuntimeResult.wasmGasUsed`
  - `ScriptRuntimeResult.wasmGasRemaining`
- Processor gas accounting converts wasm fuel via `ProcessorGasSchedule`.

## Undefined/null and emit semantics

Sidecar preserves JS result semantics:

- explicit `null` => `resultDefined=true`, `result=null`
- `undefined` => `resultDefined=false`, `result=null`

Emit parity:

- when emit callback is not supplied, sidecar returns emitted events in result envelope (`events[]` / `__result*` metadata),
- when Java evaluator emit callback is supplied, evaluator forwards emitted payloads to callback and returns plain script value.

## Document/canon behavior

- QuickJS built-in host globals (`document`, `canon`) are used directly.
- `QuickJSEvaluator` rewrites alias calls for parity compatibility:
  - `document.get(...)` -> `document(...)`
  - `document.getCanonical(...)` -> `document.canonical(...)`
- Sidecar host document handlers implement:
  - scope-relative pointer resolution via `__scopePath`,
  - fallback from `__documentDataSimple` to `__documentData`,
  - canonical fallback where required (`__documentDataCanonical` -> simple),
  - raw terminal segment unwrapping (`blueId`, `name`, `description`, `value`) for plain/canonical reads.

## Dependency management

- Sidecar dependencies are declared in `tools/quickjs-sidecar/package.json`.
- `QuickJsSidecarRuntime` installs sidecar dependencies on first start when `node_modules` is missing.

## Failure mapping

- Out-of-gas runtime failures map to `OutOfGasError`.
- JS exceptions preserve error name/message and stack payload when available.
- Evaluator wraps all runtime failures as `CodeBlockEvaluationError` while preserving structured runtime metadata.
