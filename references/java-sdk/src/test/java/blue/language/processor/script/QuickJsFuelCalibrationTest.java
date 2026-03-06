package blue.language.processor.script;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigInteger;
import java.util.LinkedHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class QuickJsFuelCalibrationTest {

    @Test
    void capturesDeterministicBaselineFuelForRepresentativeScripts() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs fuel tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            BigInteger returnOne = usedFuel(evaluator, "return 1;");
            BigInteger loop1k = usedFuel(evaluator,
                    "let sum = 0;\nfor (let i = 0; i < 1000; i += 1) {\n  sum += i;\n}\nreturn sum;");
            BigInteger loop10k = usedFuel(evaluator,
                    "let sum = 0;\nfor (let i = 0; i < 10000; i += 1) {\n  sum += i;\n}\nreturn sum;");

            assertTrue(returnOne.compareTo(BigInteger.ZERO) > 0);
            assertTrue(loop1k.compareTo(returnOne) > 0);
            assertTrue(loop10k.compareTo(loop1k) > 0);
        }
    }

    @Test
    void fuelUsageIsStableAcrossRepeatedEvaluations() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs fuel tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            String code = "let arr = []; for (let i = 0; i < 1000; i += 1) { arr.push(i * 2 + 1); } arr.length;";
            BigInteger first = usedFuel(evaluator, code);
            BigInteger second = usedFuel(evaluator, code);
            BigInteger third = usedFuel(evaluator, code);

            assertEquals(first, second);
            assertEquals(second, third);
        }
    }

    private BigInteger usedFuel(QuickJSEvaluator evaluator, String code) {
        ScriptRuntimeResult result = evaluator.evaluate(
                code,
                new LinkedHashMap<String, Object>(),
                QuickJsConfig.DEFAULT_WASM_GAS_LIMIT);
        return result.wasmGasUsed();
    }

    private boolean nodeAvailable() throws IOException, InterruptedException {
        Process process = new ProcessBuilder("node", "--version").start();
        int exit = process.waitFor();
        return exit == 0;
    }
}
