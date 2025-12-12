import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten';
import type { QuickJSWASMModule } from 'quickjs-emscripten';
import { gasVariant } from '@blue-labs/quickjs-wasmfile-release-sync-gas';

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
 * @returns A QuickJSWASMModule augmented with gas metering capabilities.
 */
export function loadMeteredQuickJS(): Promise<QuickJSWASMModule> {
  return newQuickJSWASMModuleFromVariant(gasVariant);
}
