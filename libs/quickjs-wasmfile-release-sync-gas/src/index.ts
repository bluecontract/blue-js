/**
 * @blue-labs/quickjs-wasmfile-release-sync-gas
 *
 * Gas-metered QuickJS WASM variant following the official quickjs-emscripten pattern.
 *
 * @example
 * ```ts
 * import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten';
 * import variant, { setGasBudget, getGasRemaining } from '@blue-labs/quickjs-wasmfile-release-sync-gas';
 *
 * const module = await newQuickJSWASMModuleFromVariant(variant);
 * setGasBudget(module, 1_000_000n);
 *
 * const vm = module.newContext();
 * vm.evalCode('1 + 1');
 * vm.dispose();
 *
 * console.log('Gas remaining:', getGasRemaining(module));
 * ```
 */

// Default export: the variant (like official packages)
export { default } from './lib/quickjs-wasm-gas.js';

// Named exports
export {
  // Variant factory (for custom WASM URLs)
  createGasVariant,
  // Gas control helpers
  getGasGlobal,
  setGasBudget,
  getGasRemaining,
  // Utility
  defaultWasmUrl,
  // Types
  type AugmentedQuickJSModule,
  type GasGlobalLike,
} from './lib/quickjs-wasm-gas.js';
