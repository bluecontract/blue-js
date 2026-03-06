package blue.language.processor.script;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigInteger;
import java.util.LinkedHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class QuickJSEvaluatorGasTest {

    @Test
    void throwsOutOfGasForInfiniteLoopUnderTinyGasBudget() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            CodeBlockEvaluationError error = assertThrows(
                    CodeBlockEvaluationError.class,
                    () -> evaluator.evaluate(
                            "while (true) {}",
                            new LinkedHashMap<String, Object>(),
                            BigInteger.valueOf(1000L)));
            Throwable cause = error.getCause();
            assertTrue(cause instanceof ScriptRuntimeException);
            assertTrue(String.valueOf(cause.getMessage()).contains("OutOfGas"), String.valueOf(cause.getMessage()));
        }
    }

    @Test
    void completesSmallScriptWithinGasBudget() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            ScriptRuntimeResult result = evaluator.evaluate(
                    "let total = 0; for (let i = 0; i < 1000; i += 1) { total += i; } return total;",
                    new LinkedHashMap<String, Object>(),
                    new BigInteger("1000000000"));
            assertEquals("499500", String.valueOf(result.value()));
        }
    }

    private boolean nodeAvailable() throws IOException, InterruptedException {
        Process process = new ProcessBuilder("node", "--version").start();
        int exit = process.waitFor();
        return exit == 0;
    }
}
