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

function defaultWasmUrl(): string {
  const url = new URL('../../../quickjs.release.gas.wasm', import.meta.url);

  // Node: import.meta.url is file://
  if (url.protocol === 'file:') {
    return url.pathname;
  }

  // Browser / dev server: http:// or https://
  return url.toString();
}

async function readWasmBytes(wasmUrl: string): Promise<Uint8Array> {
  const globalScope = globalThis as { window?: unknown };

  // Node / workers: use fs
  if (typeof globalScope.window === 'undefined') {
    const [{ fileURLToPath }, fs] = await Promise.all([
      import('node:url'),
      import('node:fs/promises'),
    ]);

    // In Node, defaultWasmUrl() gives you a file path (from url.pathname),
    // so this is safe; if you change defaultWasmUrl to return file://
    // later, fileURLToPath will still handle it.
    const filePath = wasmUrl.startsWith('file:')
      ? fileURLToPath(wasmUrl)
      : wasmUrl;

    const buf = await fs.readFile(filePath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  // Browser: use fetch. In browser builds Vite/webpack will have rewritten
  // defaultWasmUrl() so this points at the right public URL.
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch instrumented QuickJS wasm (${response.status}) from ${wasmUrl}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadMeteredQuickJS(
  wasmUrl = defaultWasmUrl(),
  baseVariant = DEFAULT_BASE_VARIANT,
): Promise<QuickJSWASMModule> {
  const wasmBytes = await readWasmBytes(wasmUrl);
  const wasmBinary = wasmBytes.buffer.slice(
    wasmBytes.byteOffset,
    wasmBytes.byteOffset + wasmBytes.byteLength,
  );

  const wasmApi = (globalThis as unknown as { WebAssembly: WebAssemblyApi })
    .WebAssembly;

  const emscriptenModuleOverrides: EmscriptenModuleLoaderOptions & {
    __gasGlobal?: GasGlobalLike;
    __gasExports?: WasmExports;
  } = { wasmBinary: wasmBinary as ArrayBuffer };

  emscriptenModuleOverrides.instantiateWasm = async (
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
  )) as AugmentedQuickJSModule;

  quickjsModule.__gasGlobal = emscriptenModuleOverrides.__gasGlobal;
  quickjsModule.__gasExports = emscriptenModuleOverrides.__gasExports;
  quickjsModule.__setGasBudget = (gas: bigint | number) => {
    const big = BigInt(gas);
    if (quickjsModule.__gasGlobal && 'value' in quickjsModule.__gasGlobal) {
      quickjsModule.__gasGlobal.value = big;
    }
  };

  return quickjsModule;
}
