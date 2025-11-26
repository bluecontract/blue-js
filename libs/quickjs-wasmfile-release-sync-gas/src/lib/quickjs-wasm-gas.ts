import {
  RELEASE_SYNC,
  type EmscriptenModuleLoaderOptions,
  type QuickJSWASMModule,
  type QuickJSSyncVariant,
  type QuickJSEmscriptenModule,
  type EmscriptenModuleLoader,
} from 'quickjs-emscripten';

export type GasGlobalLike = { value: unknown };

type WasmExports = Record<string, unknown>;
type WasmInstance = { exports: WasmExports };
type WasmInstantiateResult = WasmInstance | { instance: WasmInstance };
type WebAssemblyApi = {
  instantiate: (
    bytes: ArrayBuffer | ArrayBufferView,
    imports?: Record<string, unknown>,
  ) => Promise<WasmInstantiateResult>;
};

type GasAugmentedEmscriptenModule = QuickJSEmscriptenModule & {
  __gasGlobal?: GasGlobalLike;
};

/**
 * Module augmented with gas metering capabilities.
 * Access gas controls via `getGasGlobal()` and `setGasBudget()` helpers.
 */
export type AugmentedQuickJSModule = QuickJSWASMModule & {
  /** @internal - Access via getGasGlobal() helper */
  module: GasAugmentedEmscriptenModule;
};

const isGasGlobal = (value: unknown): value is GasGlobalLike =>
  Boolean(value && typeof value === 'object' && 'value' in (value as object));

/**
 * Returns the default URL for the instrumented QuickJS wasm file.
 * In Node: returns a file path from the URL.
 * In Browser: returns the full URL string.
 */
export function defaultWasmUrl(): string {
  const url = new URL('../../quickjs.release.gas.wasm', import.meta.url);

  // Node: import.meta.url is file://
  if (url.protocol === 'file:') {
    return url.pathname;
  }

  // Browser / dev server: http:// or https://
  return url.toString();
}

/**
 * Reads WASM bytes from a URL, handling both Node and browser environments.
 */
async function readWasmBytes(wasmUrl: string): Promise<Uint8Array> {
  const globalScope = globalThis as { window?: unknown };

  // Node / workers: use fs
  if (typeof globalScope.window === 'undefined') {
    const [{ fileURLToPath }, fs] = await Promise.all([
      import('node:url'),
      import('node:fs/promises'),
    ]);

    const filePath = wasmUrl.startsWith('file:')
      ? fileURLToPath(wasmUrl)
      : wasmUrl;

    const buf = await fs.readFile(filePath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  // Browser: use fetch
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch instrumented QuickJS wasm (${response.status}) from ${wasmUrl}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Gas Control Helpers
// ---------------------------------------------------------------------------

/**
 * Gets the gas global from a module loaded with the gas variant.
 * Returns undefined if the module wasn't loaded with gas instrumentation.
 */
export function getGasGlobal(
  module: QuickJSWASMModule,
): GasGlobalLike | undefined {
  const mod = module as AugmentedQuickJSModule;
  return mod.module?.__gasGlobal;
}

/**
 * Sets the gas budget for execution.
 * @throws Error if the module wasn't loaded with gas instrumentation.
 */
export function setGasBudget(
  module: QuickJSWASMModule,
  gas: bigint | number,
): void {
  const gasGlobal = getGasGlobal(module);
  if (!gasGlobal) {
    throw new Error(
      'Gas budget setter not found; ensure module was loaded with gas variant',
    );
  }
  gasGlobal.value = BigInt(gas);
}

/**
 * Reads the remaining gas from the module.
 * Returns undefined if gas metering is not available.
 */
export function getGasRemaining(module: QuickJSWASMModule): bigint | undefined {
  const gasGlobal = getGasGlobal(module);
  const rawValue = gasGlobal?.value;

  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }
  if (typeof rawValue === 'bigint') {
    return rawValue;
  }
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return BigInt(Math.trunc(rawValue));
  }
  if (typeof rawValue === 'string') {
    try {
      return BigInt(rawValue);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Variant Factory
// ---------------------------------------------------------------------------

/**
 * Creates a QuickJSSyncVariant configured with gas-instrumented WASM.
 *
 * This follows the official quickjs-emscripten variant pattern.
 * Use with `newQuickJSWASMModuleFromVariant()`.
 *
 * @example
 * ```ts
 * import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten';
 * import gasVariant, { setGasBudget, getGasRemaining } from '@blue-labs/quickjs-wasmfile-release-sync-gas';
 *
 * const module = await newQuickJSWASMModuleFromVariant(gasVariant);
 * setGasBudget(module, 1_000_000n);
 *
 * const vm = module.newContext();
 * // ... use vm ...
 *
 * console.log('Gas remaining:', getGasRemaining(module));
 * ```
 *
 * @param wasmUrl - Optional URL to the instrumented WASM file. Defaults to the bundled wasm.
 */
export function createGasVariant(
  wasmUrl = defaultWasmUrl(),
): QuickJSSyncVariant {
  return {
    type: 'sync',
    importFFI: () => RELEASE_SYNC.importFFI(),
    importModuleLoader: async () => {
      const wasmBytes = await readWasmBytes(wasmUrl);
      const wasmBinary = wasmBytes.buffer.slice(
        wasmBytes.byteOffset,
        wasmBytes.byteOffset + wasmBytes.byteLength,
      );

      const baseLoaderModule = await RELEASE_SYNC.importModuleLoader();
      // Handle both direct function and { default: fn } module shapes
      type LoaderFn = EmscriptenModuleLoader<QuickJSEmscriptenModule>;
      const baseLoaderFactory: LoaderFn =
        typeof baseLoaderModule === 'function'
          ? (baseLoaderModule as LoaderFn)
          : ((baseLoaderModule as { default: LoaderFn }).default as LoaderFn);

      const wasmApi = (globalThis as unknown as { WebAssembly: WebAssemblyApi })
        .WebAssembly;

      const gasModuleLoader: LoaderFn = async (
        options?: EmscriptenModuleLoaderOptions,
      ) => {
        const moduleOverrides: EmscriptenModuleLoaderOptions & {
          __gasGlobal?: GasGlobalLike;
        } = {
          ...options,
          wasmBinary: wasmBinary as ArrayBuffer,
        };

        moduleOverrides.instantiateWasm = async (
          imports: Record<string, unknown> | undefined,
          onSuccess: (instance: WasmInstance) => void,
        ) => {
          const normalizedImports =
            imports && typeof imports === 'object'
              ? (imports as Record<string, Record<string, unknown>>)
              : {};

          const instantiated = await wasmApi.instantiate(
            wasmBytes,
            normalizedImports,
          );

          const instance =
            'instance' in instantiated
              ? instantiated.instance
              : (instantiated as WasmInstance);

          const exports = instance.exports ?? {};
          const gas = exports.gas_left;
          if (isGasGlobal(gas)) {
            moduleOverrides.__gasGlobal = gas;
          }

          onSuccess(instance);
          return exports;
        };

        const emscriptenModule = await baseLoaderFactory(moduleOverrides);

        // Attach gas global to the emscripten module for retrieval via helpers
        (emscriptenModule as GasAugmentedEmscriptenModule).__gasGlobal =
          moduleOverrides.__gasGlobal;

        return emscriptenModule;
      };

      return gasModuleLoader;
    },
  };
}

/**
 * Default gas-instrumented QuickJS variant.
 *
 * ### @blue-labs/quickjs-wasmfile-release-sync-gas
 *
 * Gas-metered variant of QuickJS. Uses a custom instrumented WASM binary
 * that tracks execution cost via a mutable global.
 *
 * | Variable            | Setting      | Description |
 * | --                  | --           | --          |
 * | library             | quickjs      | Based on bellard/quickjs |
 * | releaseMode         | release      | Optimized for performance |
 * | syncMode            | sync         | Synchronous execution |
 * | gasMetering         | enabled      | Tracks execution cost |
 *
 * @example
 * ```ts
 * import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten';
 * import variant, { setGasBudget } from '@blue-labs/quickjs-wasmfile-release-sync-gas';
 *
 * const module = await newQuickJSWASMModuleFromVariant(variant);
 * setGasBudget(module, 1_000_000n);
 * ```
 */
const variant: QuickJSSyncVariant = createGasVariant();

export default variant;
