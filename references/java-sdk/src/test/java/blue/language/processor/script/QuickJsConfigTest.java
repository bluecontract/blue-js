package blue.language.processor.script;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class QuickJsConfigTest {

    @Test
    void exposesGasScheduleConstantsAndConversionFunctions() {
        assertEquals(1700L, QuickJsConfig.WASM_FUEL_PER_HOST_GAS_UNIT);
        assertEquals(40000L, QuickJsConfig.DEFAULT_JS_STEP_HOST_GAS_LIMIT);
        assertEquals(40000L, QuickJsConfig.DEFAULT_EXPRESSION_HOST_GAS_LIMIT);
        assertEquals(new BigInteger("68000000"), QuickJsConfig.DEFAULT_WASM_GAS_LIMIT);
        assertEquals(new BigInteger("68000000"), QuickJsConfig.DEFAULT_EXPRESSION_WASM_GAS_LIMIT);
        assertEquals(new BigInteger("8500"), QuickJsConfig.hostGasToWasmFuel(5L));
    }
}
