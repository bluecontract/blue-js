import {
  RELEASE_SYNC,
  newQuickJSWASMModuleFromVariant,
  newVariant,
  type EmscriptenModuleLoaderOptions,
  type QuickJSWASMModule,
} from 'quickjs-emscripten';

const DEFAULT_BASE_VARIANT = RELEASE_SYNC;

type GasGlobalLike = { value: unknown };
type WasmExports = Record<string, unknown>;
type WasmInstance = { exports: WasmExports };
type WasmInstantiateResult = WasmInstance | { instance: WasmInstance };
type WebAssemblyApi = {
  instantiate: (
    bytes: ArrayBuffer | ArrayBufferView,
    imports?: Record<string, unknown>,
  ) => Promise<WasmInstantiateResult>;
};

type AugmentedQuickJSModule = QuickJSWASMModule & {
  __gasGlobal?: GasGlobalLike;
  __gasExports?: WasmExports;
  __setGasBudget?: (gas: bigint | number) => void;
};

const isGasGlobal = (value: unknown): value is GasGlobalLike =>
  Boolean(value && typeof value === 'object' && 'value' in (value as object));

async function readWasmBytes(wasmUrl: string): Promise<Uint8Array> {
  const globalScope = globalThis as { window?: unknown };
  if (typeof globalScope.window === 'undefined') {
    const fs = await import('node:fs/promises');
    return new Uint8Array(await fs.readFile(wasmUrl));
  }

  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch instrumented QuickJS wasm (${response.status})`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadMeteredQuickJS(
  wasmUrl = resolvePackagedWasmUrl(),
  baseVariant = DEFAULT_BASE_VARIANT,
) {
  const wasmBytes = await readWasmBytes(wasmUrl);
  const wasmBinary = wasmBytes.buffer.slice(
    wasmBytes.byteOffset,
    wasmBytes.byteOffset + wasmBytes.byteLength,
  ) as ArrayBuffer;
  // Large default to survive module init; evaluator will reset per execution.
  let currentGasBudget = 1_000_000_000_000n;

  const wasmApi = (globalThis as unknown as { WebAssembly: WebAssemblyApi })
    .WebAssembly;

  // Let Emscripten perform instantiation so it wires exports onto the module object.
  const emscriptenModuleOverrides: EmscriptenModuleLoaderOptions & {
    __gasGlobal?: GasGlobalLike;
    __gasExports?: WasmExports;
  } = { wasmBinary };

  emscriptenModuleOverrides.instantiateWasm = async (
    imports: Record<string, unknown> | undefined,
    onSuccess: (instance: WasmInstance) => void,
  ) => {
    const normalizedImports =
      imports && typeof imports === 'object'
        ? (imports as Record<string, Record<string, unknown>>)
        : ({} as Record<string, Record<string, unknown>>);

    const importsEnv =
      normalizedImports.env ??
      ((normalizedImports.env = {}) as Record<string, unknown>);

    importsEnv.gas_charge = (amount: number | bigint) => {
      currentGasBudget -= BigInt(amount);
      if (currentGasBudget < 0n) {
        // Throwing propagates as a wasm trap; evaluator will normalize to OutOfGas.
        throw new Error('OutOfGas');
      }
    };

    const instantiated = await wasmApi.instantiate(
      wasmBytes,
      normalizedImports,
    );
    const instance =
      'instance' in instantiated
        ? instantiated.instance
        : (instantiated as WasmInstance);

    const exports = instance.exports ?? {};
    const gas = (exports as WasmExports).gas_left;
    if (isGasGlobal(gas)) {
      emscriptenModuleOverrides.__gasGlobal = gas;
    }
    emscriptenModuleOverrides.__gasExports = exports;
    onSuccess(instance);
    return exports;
  };

  const gasVariant = newVariant(baseVariant, {
    emscriptenModule: emscriptenModuleOverrides,
  });
  const quickjsModule = (await newQuickJSWASMModuleFromVariant(
    gasVariant,
  )) as unknown as AugmentedQuickJSModule;

  quickjsModule.__gasGlobal = emscriptenModuleOverrides.__gasGlobal;
  quickjsModule.__gasExports = emscriptenModuleOverrides.__gasExports;
  quickjsModule.__setGasBudget = (gas: bigint | number) => {
    const big = BigInt(gas);
    if (quickjsModule.__gasGlobal && 'value' in quickjsModule.__gasGlobal) {
      quickjsModule.__gasGlobal.value = big;
    }
    currentGasBudget = big;
  };

  return quickjsModule;
}

function resolvePackagedWasmUrl(): string {
  // Point to the packaged artifact shipped alongside this module.
  // Works in Node (file path) and browsers (URL string fetched by bundler).
  const url = new URL('../../../quickjs.release.gas.wasm', import.meta.url);
  if (url.protocol === 'file:') {
    // Node/fs friendly path.
    return url.pathname;
  }
  return url.toString();
}
