package blue.language.processor;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProcessorGasScheduleTest {

    @Test
    void exposesExpectedQuickJsGasScheduleConstants() {
        assertEquals(1_700L, ProcessorGasSchedule.WASM_FUEL_PER_HOST_GAS_UNIT);
        assertEquals(40_000L, ProcessorGasSchedule.DEFAULT_JS_STEP_HOST_GAS_LIMIT);
        assertEquals(40_000L, ProcessorGasSchedule.DEFAULT_EXPRESSION_HOST_GAS_LIMIT);
        assertEquals(BigInteger.valueOf(68_000_000L), ProcessorGasSchedule.DEFAULT_WASM_GAS_LIMIT);
        assertEquals(BigInteger.valueOf(68_000_000L), ProcessorGasSchedule.DEFAULT_EXPRESSION_WASM_GAS_LIMIT);
    }

    @Test
    void hostGasToWasmFuelConvertsWithZeroFloor() {
        assertEquals(BigInteger.ZERO, ProcessorGasSchedule.hostGasToWasmFuel(0L));
        assertEquals(BigInteger.ZERO, ProcessorGasSchedule.hostGasToWasmFuel(-1L));
        assertEquals(BigInteger.valueOf(1_700L), ProcessorGasSchedule.hostGasToWasmFuel(1L));
        assertEquals(BigInteger.valueOf(8_500L), ProcessorGasSchedule.hostGasToWasmFuel(5L));
    }

    @Test
    void wasmFuelToHostGasUsesCeilingDivision() {
        assertEquals(0L, ProcessorGasSchedule.wasmFuelToHostGas(null));
        assertEquals(0L, ProcessorGasSchedule.wasmFuelToHostGas(BigInteger.ZERO));
        assertEquals(1L, ProcessorGasSchedule.wasmFuelToHostGas(BigInteger.ONE));
        assertEquals(1L, ProcessorGasSchedule.wasmFuelToHostGas(BigInteger.valueOf(1_700L)));
        assertEquals(2L, ProcessorGasSchedule.wasmFuelToHostGas(BigInteger.valueOf(1_701L)));
        assertEquals(3L, ProcessorGasSchedule.wasmFuelToHostGas(BigInteger.valueOf(5_001L)));
    }
}
