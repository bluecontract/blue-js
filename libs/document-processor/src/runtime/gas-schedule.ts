/**
 * Conversion factor from deterministic runtime fuel to host gas units used by
 * the document processor gas meter.
 */
const WASM_FUEL_PER_HOST_GAS_UNIT_INTERNAL = 1_700;
const WASM_FUEL_PER_HOST_GAS_UNIT_BIGINT = BigInt(
  WASM_FUEL_PER_HOST_GAS_UNIT_INTERNAL,
);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export const WASM_FUEL_PER_HOST_GAS_UNIT = WASM_FUEL_PER_HOST_GAS_UNIT_INTERNAL;

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
