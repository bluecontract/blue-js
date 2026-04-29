# Document Processor JavaScript

Document JavaScript runs in `blue-quickjs`, a deterministic QuickJS-in-Wasm
runtime. It does not run in Node.js or a browser, and it only has access to the
document-processor host bindings listed below.

Document workflow steps and expressions are script-only. Runtime `import`,
dynamic `import()`, filesystem access, network access, host clock APIs, and
random sources are not part of the supported document-author surface. The lower
level evaluator can also execute prebuilt deterministic `ModulePack.v1`
artifacts for internal/runtime use.

## Authoring Model

JavaScript can run from three processor surfaces:

- `Conversation/JavaScript Code` workflow steps.
- `${...}` expressions inside `Conversation/Update Document` steps.
- `${...}` expressions inside `Conversation/Trigger Event` steps.

Every script and expression must return values that can cross the deterministic
value boundary. Valid values are `null`, booleans, finite numbers, strings,
arrays, and plain objects composed from those values.

## Available Bindings

These globals are available to document JavaScript:

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

See [javascript-host-abi.md](./javascript-host-abi.md) for the precise host ABI.

Important behavior:

- `document('/missing')` returns `null`.
- `document()` reads `/`.
- Relative pointers are resolved by the processor execution context.
- `document.canonical()` returns the canonical JSON shape.
- `emit(value)` emits immediately from a JavaScript Code step and returns `null`.
- `steps` contains prior workflow step results keyed by step name.
- `currentContract` is the current contract as simple JSON.
- `currentContractCanonical` is the same contract in canonical JSON form.

## JavaScript Code Step

```yaml
name: Counter Workflow
counter: 2
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Compute
        type: Conversation/JavaScript Code
        code: |
          const next = document('/counter') + 1;
          emit({
            type: 'Conversation/Chat Message',
            message: 'Counter is ' + next
          });
          return { next };
      - name: Apply
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /counter
            val: "${steps.Compute.next}"
```

## JavaScript Module Contracts

Documents can define reusable deterministic ESM modules as contracts and execute
them from a workflow step. Until these types are published by
`@blue-repository/types`, use the local `blueId` constants exported by
`@blue-labs/document-processor`.

```yaml
name: Counter Module Workflow
counter: 4
contracts:
  life:
    type: Core/Lifecycle Event Channel

  helper:
    type:
      name: Conversation/JavaScript Module
      blueId: blue-js/document-processor/JavaScriptModule
    specifier: ./helper.js
    source: |
      export function next(value) {
        return value + 1;
      }

  entry:
    type:
      name: Conversation/JavaScript Module
      blueId: blue-js/document-processor/JavaScriptModule
    specifier: ./entry.js
    source: |
      import { next } from './helper.js';

      export default {
        events: [
          {
            type: 'Conversation/Chat Message',
            message: 'Counter is ' + next(document('/counter'))
          }
        ]
      };

  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Compute
        type:
          name: Conversation/JavaScript Module Code
          blueId: blue-js/document-processor/JavaScriptModuleCode
        entrySpecifier: ./entry.js
        modules:
          - /contracts/entry
          - /contracts/helper
```

Module step fields:

- `entrySpecifier`: module specifier whose export becomes the step result.
- `entryExport`: optional export name; defaults to `default`.
- `modules`: document pointers to `Conversation/JavaScript Module` contracts.

Module contract fields:

- `specifier`: stable ESM specifier, such as `./entry.js`.
- `source`: deterministic ESM source text.
- `sourceMap`: optional canonical source map JSON string.

The processor builds a deterministic `ModulePack.v1` from the referenced module
contracts, computes its `graphHash`, and runs it through the same QuickJS host
ABI as script code.

## Update Document Expression

Use `${...}` when a changeset field should be computed by JavaScript:

```yaml
steps:
  - name: ApplyDelta
    type: Conversation/Update Document
    changeset:
      - op: REPLACE
        path: /counter
        val: "${document('/counter') + event.delta}"
```

Expressions are wrapped as `return (<expression>);`, so statement bodies must be
inside an expression such as an immediately invoked function:

```yaml
val: "${(() => { const value = document('/counter'); return value + 1; })()}"
```

## Trigger Event Expression

Trigger Event payloads can also contain expressions:

```yaml
steps:
  - name: Notify
    type: Conversation/Trigger Event
    event:
      type: Conversation/Chat Message
      message: "Counter is ${document('/counter')}"
```

`emit()` is available to all document JavaScript evaluation surfaces, including
Update Document and Trigger Event expressions. An expression such as
`${emit({ type: 'Conversation/Chat Message', message: 'updated' })}` emits as a
side effect while the expression is being resolved. Use this deliberately:
expression side effects happen before the containing step finishes applying its
own update or event payload.

Use `Conversation/Trigger Event` when the step's main purpose is to emit a
templated event. Use `emit()` when emission is part of a larger JavaScript
calculation.

## Step Results And Current Contract

Named step results are available through `steps`:

```js
return steps.ComputeTotal.amount + document('/fee');
```

The current workflow contract is available as `currentContract`:

```js
return {
  description: currentContract.description,
  canonicalName: currentContractCanonical.name
};
```

## Deterministic Restrictions

Document JavaScript is intentionally smaller than normal JavaScript:

- No Node.js globals such as `process`, `fs`, or network clients.
- No browser globals such as `window` or `fetch`.
- No host clock or random source such as `Date.now()` or `Math.random()`.
- No filesystem, network, package-manager, or registry lookup.
- No runtime imports or dynamically loaded modules in document workflows.
- Host callbacks are synchronous only.
- Final results, host-call arguments, `emit()` payloads, and document update
  values must be valid deterministic values.

Execution profile determines which deterministic language features are enabled.
The default profile is `baseline-v1`. Maintainers may opt into
`compat-general-v1` or `compat-binary-v1` for compatible runtime features, but
document workflows should not depend on arbitrary unversioned profiles.

## Gas And Limits

JavaScript has separate limits for expressions and full JavaScript Code steps.
The processor charges:

```text
QuickJS/Wasm gas
+ QuickJS host-call units
+ processor document snapshot gas for document reads
```

This is expected. QuickJS gas accounts for deterministic VM execution, while
processor gas accounts for host-side document access. See
[javascript-gas-policy.md](./javascript-gas-policy.md) for details.

Out-of-gas failures terminate the current processor scope fatally and emit a
`Core/Document Processing Terminated` event.

## Maintainer Configuration

Configure the default processor JavaScript policy at construction time:

```ts
import { DocumentProcessor } from '@blue-labs/document-processor';

const processor = new DocumentProcessor({
  javascript: {
    executionProfile: 'baseline-v1',
    jsExpressionGasLimit: 10_000n,
    jsCodeStepGasLimit: 1_000_000n,
    enableGasTrace: false,
    onGasTrace: (trace) => {
      console.log(trace.opcodeCount, trace.opcodeGas);
    },
  },
});
```

`javascript` policy is applied when the processor builds its default registry.
If you pass a custom `registry`, that registry already owns its workflow
processors and step executors, so `javascript` options do not retrofit those
custom processors. Build the custom registry with
`ContractProcessorRegistryBuilder.create().registerDefaults({ javascript })` or
construct step executors with a configured `BlueQuickJsEngine`.

Release-mode execution requires artifact pins for the QuickJS Wasm build and gas
schedule:

```ts
import { BlueQuickJsEngine } from '@blue-labs/document-processor';

const engine = new BlueQuickJsEngine({
  executionProfile: 'baseline-v1',
  enableGasTrace: true,
  onGasTrace: (trace) => {
    console.log(trace.hostCallPreCount, trace.hostCallPostCount);
  },
  releaseMode: true,
  artifactPins: {
    engineBuildHash:
      'f91091cb7feb788df340305a877a9cadb0c6f4d13aea8a7da4040b6367d178ea',
    gasVersion: 8,
  },
});
```

When `releaseMode` is true, evaluation rejects artifacts missing
`engineBuildHash`, `gasVersion`, or `executionProfile`. It also rejects
mismatched execution profiles, engine build hashes, gas versions, and ABI
manifest hashes.

## Common Errors

- `OutOfGasError`: the script exceeded its configured gas limit.
- `HostError` / `INVALID_PATH`: a document host call failed, often from an
  invalid pointer.
- `HostError` / `LIMIT_EXCEEDED`: a host value or `emit()` payload was not valid
  deterministic data, or a host callback was asynchronous.
- `InvalidOutputError`: the final script result could not be encoded as a
  deterministic value.
- `SyntaxError`: the selected execution profile does not support the JavaScript
  syntax being used, or an expression contains statements without wrapping them
  in an expression.
- `ABI_MANIFEST_HASH_MISMATCH`: the artifact expected a different Host ABI
  manifest than the processor provided.

## Copyable Test References

The integration tests in
`src/__tests__/DocumentProcessorJavaScriptDeterminismTest.test.ts` contain
copyable processor workflows that exercise JavaScript Code steps, Update
Document expressions, `emit()`, `document()`, `document.canonical()`, `steps`,
`event`, and `currentContract` through the real processor.

Release-mode and artifact-pin behavior is covered in
`src/util/expression/__tests__/quickjs-release-pins.test.ts`.
