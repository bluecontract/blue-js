# @blue-labs/quickjs-wasmfile-release-sync-gas

Gas-metered QuickJS WASM variant with EVM-inspired gas scheduling.

This package provides a variant of QuickJS compiled to WebAssembly with gas metering instrumentation injected via `wasm-instrument`. It follows the same pattern as the official [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten) variants.

## Requirements

- **Rust** - Required to compile the WASM instrumentation tool
- **Node.js** ≥ 18

## Installation

```bash
npm install @blue-labs/quickjs-wasmfile-release-sync-gas quickjs-emscripten
```

## Usage

```typescript
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten';
import variant, { setGasBudget, getGasRemaining } from '@blue-labs/quickjs-wasmfile-release-sync-gas';

const module = await newQuickJSWASMModuleFromVariant(variant);
setGasBudget(module, 1_000_000n);

const vm = module.newContext();
vm.evalCode('1 + 1');
vm.dispose();

console.log('Gas remaining:', getGasRemaining(module));
```

## Building

This library requires Rust to build the instrumented WASM file.

```bash
# Build everything (instrument wasm + compile TypeScript)
nx build quickjs-wasmfile-release-sync-gas

# Or just instrument the wasm
npm run build:c --prefix libs/quickjs-wasmfile-release-sync-gas
```

The build process:

1. Compiles the Rust instrumentation tool (`tools/quickjs-gas-instrument/`)
2. Instruments the upstream QuickJS WASM from `@jitl/quickjs-wasmfile-release-sync`
3. Compiles TypeScript sources

## Gas Schedule

See [docs/gas-schedule.md](./docs/gas-schedule.md) for details on the EVM-inspired gas cost schedule.

## Exports

- `default` - The variant for use with `newQuickJSWASMModuleFromVariant`
- `createGasVariant(wasmUrl)` - Create a variant with a custom WASM URL
- `setGasBudget(module, gas)` - Set the gas budget before execution
- `getGasRemaining(module)` - Get remaining gas after execution
- `getGasGlobal(module)` - Access the raw gas global for advanced usage

## License

MIT
