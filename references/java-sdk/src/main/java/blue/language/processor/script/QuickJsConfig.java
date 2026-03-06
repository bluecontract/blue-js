package blue.language.processor.script;

import blue.language.processor.ProcessorGasSchedule;

import java.math.BigInteger;

/**
 * QuickJS-facing gas configuration exports aligned with JS runtime config.
 */
public final class QuickJsConfig {

    public static final long WASM_FUEL_PER_HOST_GAS_UNIT = ProcessorGasSchedule.WASM_FUEL_PER_HOST_GAS_UNIT;
    public static final long DEFAULT_JS_STEP_HOST_GAS_LIMIT = ProcessorGasSchedule.DEFAULT_JS_STEP_HOST_GAS_LIMIT;
    public static final long DEFAULT_EXPRESSION_HOST_GAS_LIMIT = ProcessorGasSchedule.DEFAULT_EXPRESSION_HOST_GAS_LIMIT;
    public static final BigInteger DEFAULT_WASM_GAS_LIMIT = ProcessorGasSchedule.DEFAULT_WASM_GAS_LIMIT;
    public static final BigInteger DEFAULT_EXPRESSION_WASM_GAS_LIMIT = ProcessorGasSchedule.DEFAULT_EXPRESSION_WASM_GAS_LIMIT;

    private QuickJsConfig() {
    }

    public static BigInteger hostGasToWasmFuel(long hostGas) {
        return ProcessorGasSchedule.hostGasToWasmFuel(hostGas);
    }

    public static BigInteger hostGasToWasmFuel(BigInteger hostGas) {
        return ProcessorGasSchedule.hostGasToWasmFuel(hostGas);
    }
}
