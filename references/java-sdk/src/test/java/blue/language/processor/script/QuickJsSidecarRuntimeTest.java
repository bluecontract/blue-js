package blue.language.processor.script;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigInteger;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class QuickJsSidecarRuntimeTest {

    @Test
    void evaluatesJavaScriptExpressionsThroughSidecarProtocol() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for sidecar tests");

        try (QuickJsSidecarRuntime runtime = new QuickJsSidecarRuntime()) {
            ScriptRuntimeResult simple = runtime.evaluate(ScriptRuntimeRequest.of("1 + 1"));
            assertEquals("2", String.valueOf(simple.value()));
            assertTrue(simple.valueDefined());

            Map<String, Object> bindings = new LinkedHashMap<>();
            bindings.put("a", 5);
            bindings.put("b", 7);
            ScriptRuntimeResult withBindings = runtime.evaluate(
                    new ScriptRuntimeRequest("a + b", bindings, BigInteger.valueOf(1234L)));

            assertEquals("12", String.valueOf(withBindings.value()));
            assertTrue(withBindings.valueDefined());
            assertTrue(withBindings.wasmGasUsed() != null && withBindings.wasmGasUsed().compareTo(BigInteger.ZERO) > 0);
            assertTrue(withBindings.wasmGasRemaining() != null
                    && withBindings.wasmGasRemaining().compareTo(new BigInteger("1234")) < 0
                    && withBindings.wasmGasRemaining().compareTo(BigInteger.ZERO) >= 0);

            ScriptRuntimeResult withEmit = runtime.evaluate(ScriptRuntimeRequest.of(
                    "emit({ kind: 'callback' }); 9"));
            assertTrue(withEmit.value() instanceof Map);
            assertTrue(withEmit.valueDefined());
            @SuppressWarnings("unchecked")
            Map<String, Object> emittedPayload = (Map<String, Object>) withEmit.value();
            assertEquals("9", String.valueOf(emittedPayload.get("__result")));
            assertTrue(emittedPayload.get("events") instanceof List);

            ScriptRuntimeResult withEmitUndefined = runtime.evaluate(ScriptRuntimeRequest.of(
                    "(() => { emit({ kind: 'callback' }); })();"));
            assertTrue(withEmitUndefined.value() instanceof Map);
            assertFalse(withEmitUndefined.valueDefined());
            @SuppressWarnings("unchecked")
            Map<String, Object> undefinedPayload = (Map<String, Object>) withEmitUndefined.value();
            assertEquals(Boolean.FALSE, undefinedPayload.get("__resultDefined"));
            assertTrue(undefinedPayload.get("events") instanceof List);

            ScriptRuntimeResult withoutDate = runtime.evaluate(ScriptRuntimeRequest.of("typeof Date"));
            assertEquals("undefined", String.valueOf(withoutDate.value()));
            assertTrue(withoutDate.valueDefined());

            ScriptRuntimeResult withoutProcess = runtime.evaluate(ScriptRuntimeRequest.of("typeof process"));
            assertEquals("undefined", String.valueOf(withoutProcess.value()));
            assertTrue(withoutProcess.valueDefined());

            ScriptRuntimeResult explicitNull = runtime.evaluate(ScriptRuntimeRequest.of("null"));
            assertTrue(explicitNull.valueDefined());
            assertNull(explicitNull.value());

            ScriptRuntimeResult undefinedResult = runtime.evaluate(ScriptRuntimeRequest.of("void 0"));
            assertNull(undefinedResult.value());
            assertFalse(undefinedResult.valueDefined());

            ScriptRuntimeException thrown = assertThrows(
                    ScriptRuntimeException.class,
                    () -> runtime.evaluate(ScriptRuntimeRequest.of("throw new Error('boom')")));
            assertTrue(thrown.getMessage().contains("Error: boom"));
        }
    }

    @Test
    void reportsDeterministicGasUsageForIdenticalCode() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for sidecar tests");

        try (QuickJsSidecarRuntime runtime = new QuickJsSidecarRuntime()) {
            ScriptRuntimeResult first = runtime.evaluate(
                    new ScriptRuntimeRequest("return 1;", new LinkedHashMap<String, Object>(), new BigInteger("1000000")));
            ScriptRuntimeResult second = runtime.evaluate(
                    new ScriptRuntimeRequest("return 1;", new LinkedHashMap<String, Object>(), new BigInteger("1000000")));
            ScriptRuntimeResult heavier = runtime.evaluate(
                    new ScriptRuntimeRequest(
                            "let sum = 0; for (let i = 0; i < 10000; i += 1) { sum += i; } return sum;",
                            new LinkedHashMap<String, Object>(),
                            new BigInteger("1000000")));

            assertEquals(first.wasmGasUsed(), second.wasmGasUsed());
            assertTrue(heavier.wasmGasUsed().compareTo(first.wasmGasUsed()) > 0);
        }
    }

    @Test
    void exposesStructuredErrorDetailsForRuntimeFailures() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for sidecar tests");

        try (QuickJsSidecarRuntime runtime = new QuickJsSidecarRuntime()) {
            ScriptRuntimeException typeError = assertThrows(
                    ScriptRuntimeException.class,
                    () -> runtime.evaluate(ScriptRuntimeRequest.of("throw new TypeError('bad input')")));
            assertEquals("TypeError", typeError.errorName());
            assertEquals("bad input", typeError.runtimeMessage());
            assertTrue(typeError.stackAvailable());
            assertTrue(String.valueOf(typeError.runtimeStack()).contains("TypeError: bad input"));
            assertTrue(typeError.getMessage().contains("TypeError: bad input"));

            ScriptRuntimeException outOfGas = assertThrows(
                    ScriptRuntimeException.class,
                    () -> runtime.evaluate(new ScriptRuntimeRequest(
                            "while (true) {}",
                            new LinkedHashMap<String, Object>(),
                            BigInteger.ONE)));
            assertEquals("OutOfGasError", outOfGas.errorName());
            assertTrue(String.valueOf(outOfGas.runtimeMessage()).contains("OutOfGas"));
        }
    }

    @Test
    void exposesStructuredErrorDetailsForSyntaxFailures() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for sidecar tests");

        try (QuickJsSidecarRuntime runtime = new QuickJsSidecarRuntime()) {
            ScriptRuntimeException syntaxError = assertThrows(
                    ScriptRuntimeException.class,
                    () -> runtime.evaluate(ScriptRuntimeRequest.of("const value = ;")));
            assertEquals("SyntaxError", syntaxError.errorName());
            assertTrue(syntaxError.runtimeMessage() != null && !syntaxError.runtimeMessage().trim().isEmpty());
            assertTrue(syntaxError.stackAvailable());
            assertTrue(String.valueOf(syntaxError.runtimeStack()).contains("SyntaxError"));
        }
    }

    private boolean nodeAvailable() throws IOException, InterruptedException {
        Process process = new ProcessBuilder("node", "--version").start();
        int exit = process.waitFor();
        return exit == 0;
    }
}
