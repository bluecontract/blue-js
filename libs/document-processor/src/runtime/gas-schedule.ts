/**
 * Conversion factor from WASM fuel (consumed by the instrumented QuickJS VM)
 * to host gas units (used in the document processor gas meter).
 *
 * Calibration basis (see `quickjs-fuel-calibration.test.ts`):
 * keep relative weights aligned with the deterministic runtime after upgrades.
 *
 * Adjust this value when recalibrating the gas schedule after QuickJS or
 * runtime upgrades. See `config/gas-schedule.md` for full documentation.
 */
const WASM_FUEL_PER_HOST_GAS_UNIT_INTERNAL = 162_000;
const WASM_FUEL_PER_HOST_GAS_UNIT_BIGINT = BigInt(
  WASM_FUEL_PER_HOST_GAS_UNIT_INTERNAL,
);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export const WASM_FUEL_PER_HOST_GAS_UNIT = WASM_FUEL_PER_HOST_GAS_UNIT_INTERNAL;

export const DEFAULT_JS_STEP_HOST_GAS_LIMIT = 40_000;
export const DEFAULT_EXPRESSION_HOST_GAS_LIMIT = 40_000;

export function wasmFuelToHostGas(amount: bigint | number): number {
  let fuel: bigint;
  if (typeof amount === 'bigint') {
    fuel = amount;
  } else if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  } else {
    fuel = BigInt(Math.trunc(amount));
  }

  if (fuel <= 0n) {
    return 0;
  }

  const hostGas =
    (fuel + WASM_FUEL_PER_HOST_GAS_UNIT_BIGINT - 1n) /
    WASM_FUEL_PER_HOST_GAS_UNIT_BIGINT;

  if (hostGas > MAX_SAFE_BIGINT) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(hostGas);
}

export function hostGasToWasmFuel(amount: number | bigint): bigint {
  const normalized =
    typeof amount === 'bigint'
      ? amount
      : BigInt(Math.max(0, Math.trunc(amount)));
  if (normalized <= 0n) {
    return 0n;
  }
  return normalized * WASM_FUEL_PER_HOST_GAS_UNIT_BIGINT;
}

export const DEFAULT_WASM_GAS_LIMIT = hostGasToWasmFuel(
  DEFAULT_JS_STEP_HOST_GAS_LIMIT,
);

export const DEFAULT_EXPRESSION_WASM_GAS_LIMIT = hostGasToWasmFuel(
  DEFAULT_EXPRESSION_HOST_GAS_LIMIT,
);
