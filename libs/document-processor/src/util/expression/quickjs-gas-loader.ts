import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten';
import type { QuickJSWASMModule } from 'quickjs-emscripten';
import variant, {
  createGasVariant,
} from '@blue-labs/quickjs-wasmfile-release-sync-gas';

// Re-export gas control helpers for convenience
export {
  getGasGlobal,
  setGasBudget,
  getGasRemaining,
  type AugmentedQuickJSModule,
} from '@blue-labs/quickjs-wasmfile-release-sync-gas';

/**
 * Loads the gas-metered QuickJS WASM module using the official variant pattern.
 *
 * @param wasmUrl - Optional URL to the instrumented WASM file. Defaults to the bundled wasm.
 * @returns A QuickJSWASMModule augmented with gas metering capabilities.
 */
export async function loadMeteredQuickJS(
  wasmUrl?: string,
): Promise<QuickJSWASMModule> {
  const gasVariant = wasmUrl ? createGasVariant(wasmUrl) : variant;
  return newQuickJSWASMModuleFromVariant(gasVariant);
}
