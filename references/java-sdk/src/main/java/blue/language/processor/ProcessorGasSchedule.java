package blue.language.processor;

import java.math.BigInteger;

/**
 * QuickJS host gas / wasm fuel conversion schedule mirrored from JS runtime.
 */
public final class ProcessorGasSchedule {

    public static final long WASM_FUEL_PER_HOST_GAS_UNIT = 1_700L;
    public static final long DEFAULT_JS_STEP_HOST_GAS_LIMIT = 40_000L;
    public static final long DEFAULT_EXPRESSION_HOST_GAS_LIMIT = 40_000L;

    private static final BigInteger FUEL_PER_HOST_GAS_BIGINT =
            BigInteger.valueOf(WASM_FUEL_PER_HOST_GAS_UNIT);

    public static final BigInteger DEFAULT_WASM_GAS_LIMIT =
            hostGasToWasmFuel(DEFAULT_JS_STEP_HOST_GAS_LIMIT);
    public static final BigInteger DEFAULT_EXPRESSION_WASM_GAS_LIMIT =
            hostGasToWasmFuel(DEFAULT_EXPRESSION_HOST_GAS_LIMIT);

    private ProcessorGasSchedule() {
    }

    public static long wasmFuelToHostGas(BigInteger amount) {
        if (amount == null || amount.signum() <= 0) {
            return 0L;
        }
        BigInteger hostGas = amount.add(FUEL_PER_HOST_GAS_BIGINT).subtract(BigInteger.ONE)
                .divide(FUEL_PER_HOST_GAS_BIGINT);
        if (hostGas.compareTo(BigInteger.valueOf(Long.MAX_VALUE)) > 0) {
            return Long.MAX_VALUE;
        }
        return hostGas.longValue();
    }

    public static BigInteger hostGasToWasmFuel(long amount) {
        if (amount <= 0L) {
            return BigInteger.ZERO;
        }
        return BigInteger.valueOf(amount).multiply(FUEL_PER_HOST_GAS_BIGINT);
    }

    public static BigInteger hostGasToWasmFuel(BigInteger amount) {
        if (amount == null || amount.signum() <= 0) {
            return BigInteger.ZERO;
        }
        return amount.multiply(FUEL_PER_HOST_GAS_BIGINT);
    }
}
