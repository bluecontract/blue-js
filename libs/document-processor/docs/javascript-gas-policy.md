# Document Processor JavaScript Gas Policy

Document JavaScript uses two related accounting layers:

- QuickJS/Wasm gas, enforced inside `@blue-quickjs/quickjs-runtime` and reported
  as `gasUsed` / `gasRemaining`.
- Processor gas, charged through `context.gasMeter()`.

The document processor centralizes JavaScript policy on `BlueQuickJsEngine`.
Default workflow processors receive one engine instance configured with:

```ts
{
  jsExpressionGasLimit,
  jsCodeStepGasLimit,
  executionProfile,
  enableGasTrace,
  onGasTrace,
  releaseMode,
  artifactPins
}
```

Defaults are:

- expressions: `DEFAULT_EXPRESSION_WASM_GAS_LIMIT`
- JavaScript Code steps: `DEFAULT_WASM_GAS_LIMIT`
- execution profile: `baseline-v1`
- gas trace: disabled
- gas trace callback: none
- release mode: disabled
- artifact pins: none

## Charging Rule

Every processor JavaScript evaluation path must pass `onWasmGasUsed` and charge:

```ts
context.gasMeter().chargeWasmGas(used)
```

`BlueQuickJsEngine` supplies the configured JavaScript Code step gas limit when a
caller does not provide an explicit `wasmGasLimit`. Expression resolution reads
the same engine policy and supplies `jsExpressionGasLimit`.

## Cost Composition

A host call such as:

```ts
document('/counter')
```

intentionally composes several costs:

```text
QuickJS gas for executing the JavaScript call
+ QuickJS host-call units charged by the Host ABI
+ blue-js document snapshot gas charged by the document binding
```

This is not double charging. QuickJS gas accounts for deterministic VM execution
and host-call boundary cost. Processor document snapshot gas accounts for the
host-side document read and scales with processor data access policy.

## Configuration Ownership

Prefer configuring JavaScript policy at processor or engine construction:

```ts
new DocumentProcessor({
  javascript: {
    jsExpressionGasLimit: 10_000n,
    jsCodeStepGasLimit: 1_000_000n,
    executionProfile: 'baseline-v1',
    enableGasTrace: true,
    onGasTrace: (trace) => {
      console.log(trace.opcodeCount, trace.opcodeGas);
    },
    releaseMode: false,
  },
});
```

Supplying `onGasTrace` enables runtime trace collection for that evaluation even
if `enableGasTrace` is omitted. Per-evaluation callbacks passed directly to the
engine override the engine-level callback.

Individual executors may still override `wasmGasLimit` for focused tests or
specialized processors, but default document processing should use the shared
engine policy.
