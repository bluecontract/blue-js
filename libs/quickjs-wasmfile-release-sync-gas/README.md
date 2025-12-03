# @blue-labs/quickjs-wasmfile-release-sync-gas

Gas-metered QuickJS WASM variant with EVM-inspired gas scheduling.

This package provides a variant of QuickJS compiled to WebAssembly with gas metering instrumentation injected via `wasm-instrument`. It follows the same pattern as the official [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten) variants.

## Requirements

- **Rust** - Required to compile the WASM instrumentation tool
- **Docker** - Required for the deterministic clean-room build (see below)
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

### Controlling QuickJS garbage collection (deterministic runs)

The instrumented WASM exports two GC helpers for deterministic fuel measurements:

- `setRuntimeGCThreshold(module, runtime, threshold)` – sets the QuickJS runtime GC threshold (size in bytes). Passing `0xffffffff` effectively disables automatic GC.
- `collectRuntimeGarbage(module, runtime)` – runs `JS_RunGC` immediately.
- `disableRuntimeAutomaticGC(module, runtime)` – helper that sets the threshold to `0xffffffff`.

Under the hood, these functions `cwrap` the exported C symbols `QTS_RuntimeSetGCThreshold` and `QTS_RuntimeCollectGarbage` and cache them on the Emscripten module as `__gcControls`. You must pass the matching `QuickJSRuntime` instance so the correct runtime pointer is used.

Example:

```ts
import {
  disableRuntimeAutomaticGC,
  collectRuntimeGarbage,
  setRuntimeGCThreshold,
  setGasBudget,
  getGasRemaining,
} from '@blue-labs/quickjs-wasmfile-release-sync-gas';

const module = await newQuickJSWASMModuleFromVariant(variant);
const rt = module.newRuntime();

disableRuntimeAutomaticGC(module, rt); // prevent auto-GC during measurement
collectRuntimeGarbage(module, rt);     // start from a clean heap

setGasBudget(module, 10_000_000n);
const ctx = rt.newContext();
ctx.evalCode('1 + 1');
const used = 10_000_000n - (getGasRemaining(module) ?? 0n);
collectRuntimeGarbage(module, rt);     // explicit GC at a known point
ctx.dispose();
rt.dispose();
```

## Building

This library requires Rust to build the instrumented WASM file.

```bash
# Build everything (instrument wasm + compile TypeScript)
nx build quickjs-wasmfile-release-sync-gas

# Or just instrument the wasm
npm run build:c --prefix libs/quickjs-wasmfile-release-sync-gas

# Build a deterministic QuickJS wasm before instrumentation
./libs/quickjs-wasmfile-release-sync-gas/scripts/build-deterministic-wasm.sh
# Then instrument that deterministic output
IN_WASM=./libs/quickjs-wasmfile-release-sync-gas/emscripten-module-deterministic.wasm ./libs/quickjs-wasmfile-release-sync-gas/scripts/instrument-wasm.sh
```

The build process:

1. (Optional) Builds a deterministic QuickJS WASM via Docker + the clean-room Makefile (`tools/quickjs-wasm-clean/`) that mirrors `@jitl/quickjs-wasmfile-release-sync` exports, including the GC control helpers.
2. Compiles the Rust instrumentation tool (`tools/quickjs-gas-instrument/`) and injects gas tracking into the deterministic WASM.
3. Compiles TypeScript sources.

### Deterministic QuickJS WASM (experimental)

Use `./scripts/build-deterministic-wasm.sh` to rebuild the QuickJS WASM with deterministic Emscripten flags before running the gas instrumentation. This script always runs inside Docker (see below) and uses the clean-room Makefile in `tools/quickjs-wasm-clean/` inside the container.

- Uses the vendored Bellard QuickJS `2024-02-14` sources in `tools/quickjs-emscripten/vendor/quickjs` (cloned inside the Docker build, not committed locally) with `CONFIG_BIGNUM` and `CONFIG_STACK_CHECK`
- Matches the export surface of `@jitl/quickjs-wasmfile-release-sync` via the bundled `symbols.json`
- Builds with `-s ENVIRONMENT=web,worker`, `-s DETERMINISTIC=1`, `-s MALLOC=emmalloc`, `-s INITIAL_MEMORY=64MB`, `-s ALLOW_MEMORY_GROWTH=1`, `-s ERROR_ON_UNDEFINED_SYMBOLS=0`, `-O3`, `--closure 1`, and `-flto`
- Runs inside `emscripten/emsdk:3.1.65` so the toolchain is fully containerised (Docker is required)
- Writes to `emscripten-module-deterministic.wasm`, which `scripts/instrument-wasm.sh` will pick up automatically if present

Customise with environment variables (passed to `docker build`):

- `OUT_WASM` to change the deterministic WASM output path
- `QUICKJS_REPO` or `QUICKJS_COMMIT` to point at a different upstream `quickjs-emscripten` revision
- `DOCKER_BUILD_EXTRA_ARGS` to append arbitrary flags to the `docker build` invocation (e.g. `--build-arg FOO=bar`)

The underlying Dockerfile lives at `libs/quickjs-wasmfile-release-sync-gas/Dockerfile`. The build stage clones `mjwebblue/quickjs-emscripten@ba5ae55` from the `feature/gc` branch (fork with deterministic GC exports baked in) and runs the clean-room Makefile entirely inside the container. `build-deterministic-wasm.sh` wraps `docker build -o …` so the resulting `emscripten-module-deterministic.wasm` is streamed back to the host. Override `QUICKJS_REPO` / `QUICKJS_BRANCH` / `QUICKJS_COMMIT` to pin a different upstream revision.

Note: the deterministic build is intentionally Docker-only. The local `tools/quickjs-emscripten` tree is not used by the host build (the Docker stage clones the forked upstream); keep it only if you need a reference checkout when authoring changes to the clean-room Makefile or symbols.

## Gas Schedule

See [docs/gas-schedule.md](./docs/gas-schedule.md) for details on the EVM-inspired gas cost schedule.

## Exports

- `default` - The variant for use with `newQuickJSWASMModuleFromVariant`
- `createGasVariant(wasmUrl)` - Create a variant with a custom WASM URL
- `setGasBudget(module, gas)` - Set the gas budget before execution
- `getGasRemaining(module)` - Get remaining gas after execution
- `getGasGlobal(module)` - Access the raw gas global for advanced usage
- `setRuntimeGCThreshold(module, runtime, threshold)` - Set the QuickJS GC threshold
- `disableRuntimeAutomaticGC(module, runtime)` - Disable threshold-based automatic GC (sets threshold to `0xffffffff`)
- `collectRuntimeGarbage(module, runtime)` - Run QuickJS GC immediately

## License

MIT
