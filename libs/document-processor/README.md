# document-processor

Document processing runtime for Blue documents.

Document JavaScript execution uses `blue-quickjs`, a deterministic
QuickJS-in-Wasm runtime. The old native `isolated-vm` engine path is not used by
this package.

Authoring and maintainer documentation:

- [Document Processor JavaScript](./docs/javascript-execution.md)
- [JavaScript Host ABI](./docs/javascript-host-abi.md)
- [JavaScript Gas Policy](./docs/javascript-gas-policy.md)

## Building

Run `nx build document-processor` to build the library.

## Running unit tests

Run `nx test document-processor` to execute the unit tests via [Vitest](https://vitest.dev/).
