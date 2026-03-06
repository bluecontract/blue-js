package blue.language.processor.script;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigInteger;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.function.Consumer;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class QuickJSEvaluatorTest {

    @Test
    void evaluatesSynchronousCodeAndExposesBindings() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Map<String, Object> bindings = new LinkedHashMap<>();
            bindings.put("steps", 7);
            bindings.put("event", new LinkedHashMap<String, Object>() {{
                put("payload", new LinkedHashMap<String, Object>() {{
                    put("value", 5);
                }});
            }});

            ScriptRuntimeResult result = evaluator.evaluate(
                    "return steps + event.payload.value;",
                    bindings,
                    new BigInteger("1000000000"));

            assertEquals("12", String.valueOf(result.value()));
            assertTrue(result.wasmGasUsed() != null && result.wasmGasUsed().compareTo(BigInteger.ZERO) > 0);
            assertTrue(result.wasmGasRemaining() != null
                    && result.wasmGasRemaining().compareTo(new BigInteger("1000000000")) < 0
                    && result.wasmGasRemaining().compareTo(BigInteger.ZERO) >= 0);
        }
    }

    @Test
    void exposesCurrentContractBindings() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Map<String, Object> bindings = new LinkedHashMap<>();
            bindings.put("currentContract", new LinkedHashMap<String, Object>() {{
                put("foo", 1);
            }});
            bindings.put("currentContractCanonical", new LinkedHashMap<String, Object>() {{
                put("foo", new LinkedHashMap<String, Object>() {{
                    put("value", 1);
                }});
            }});

            ScriptRuntimeResult result = evaluator.evaluate(
                    "return ({ contract: currentContract, canonical: currentContractCanonical });",
                    bindings,
                    BigInteger.valueOf(1000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> value = (Map<String, Object>) result.value();
            assertTrue(value.get("contract") instanceof Map);
            assertTrue(value.get("canonical") instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> contract = (Map<String, Object>) value.get("contract");
            @SuppressWarnings("unchecked")
            Map<String, Object> canonical = (Map<String, Object>) value.get("canonical");
            assertEquals("1", String.valueOf(contract.get("foo")));
            assertTrue(canonical.get("foo") instanceof Map);
        }
    }

    @Test
    void supportsCanonHelpersAndDocumentBindings() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Map<String, Object> bindings = new LinkedHashMap<>();
            Map<String, Object> canonicalEvent = new LinkedHashMap<>();
            canonicalEvent.put("payload", new LinkedHashMap<String, Object>() {{
                put("id", new LinkedHashMap<String, Object>() {{
                    put("value", "evt-123");
                }});
            }});
            bindings.put("eventCanonical", canonicalEvent);
            bindings.put("__documentDataSimple", new LinkedHashMap<String, Object>() {{
                put("unit", "points");
            }});
            bindings.put("__documentDataCanonical", new LinkedHashMap<String, Object>() {{
                put("unit", new LinkedHashMap<String, Object>() {{
                    put("value", "points");
                }});
            }});

            ScriptRuntimeResult result = evaluator.evaluate(
                    "return ({ id: canon.unwrap(canon.at(eventCanonical, '/payload/id')), unit: document('/unit'), canonicalUnit: document.canonical('/unit').value });",
                    bindings,
                    BigInteger.valueOf(10000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> value = (Map<String, Object>) result.value();
            assertEquals("evt-123", String.valueOf(value.get("id")));
            assertEquals("points", String.valueOf(value.get("unit")));
            assertEquals("points", String.valueOf(value.get("canonicalUnit")));
        }
    }

    @Test
    void canonUnwrapSupportsDeepAndShallowModes() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            ScriptRuntimeResult result = evaluator.evaluate(
                    "const canonicalEvent = {\n" +
                            "  payload: {\n" +
                            "    id: { value: 'evt-123' },\n" +
                            "    tags: { items: [{ value: 'a' }, { value: 'b' }] }\n" +
                            "  },\n" +
                            "  name: { value: 'example' }\n" +
                            "};\n" +
                            "const pointer = canon.at(canonicalEvent, '/payload/id');\n" +
                            "return {\n" +
                            "  pointerUnwrapped: canon.unwrap(pointer),\n" +
                            "  eventPlain: canon.unwrap(canonicalEvent),\n" +
                            "  eventShallow: canon.unwrap(canonicalEvent, false),\n" +
                            "  arrayPlain: canon.unwrap({ items: [{ value: 1 }, { value: 2 }] })\n" +
                            "};",
                    new LinkedHashMap<String, Object>(),
                    BigInteger.valueOf(10000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> value = (Map<String, Object>) result.value();
            assertEquals("evt-123", String.valueOf(value.get("pointerUnwrapped")));

            assertTrue(value.get("eventPlain") instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> eventPlain = (Map<String, Object>) value.get("eventPlain");
            assertEquals("example", String.valueOf(eventPlain.get("name")));
            assertTrue(eventPlain.get("payload") instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) eventPlain.get("payload");
            assertEquals("evt-123", String.valueOf(payload.get("id")));
            assertTrue(payload.get("tags") instanceof List);
            @SuppressWarnings("unchecked")
            List<Object> tags = (List<Object>) payload.get("tags");
            assertEquals(2, tags.size());
            assertEquals("a", String.valueOf(tags.get(0)));
            assertEquals("b", String.valueOf(tags.get(1)));

            assertTrue(value.get("eventShallow") instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> eventShallow = (Map<String, Object>) value.get("eventShallow");
            assertTrue(eventShallow.get("payload") instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> shallowPayload = (Map<String, Object>) eventShallow.get("payload");
            assertTrue(shallowPayload.get("id") instanceof Map);

            assertTrue(value.get("arrayPlain") instanceof List);
            @SuppressWarnings("unchecked")
            List<Object> arrayPlain = (List<Object>) value.get("arrayPlain");
            assertEquals("1", String.valueOf(arrayPlain.get(0)));
            assertEquals("2", String.valueOf(arrayPlain.get(1)));
        }
    }

    @Test
    void wrapsSyntaxErrorsInCodeBlockEvaluationError() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            CodeBlockEvaluationError error = assertThrows(
                    CodeBlockEvaluationError.class,
                    () -> evaluator.evaluate(
                            "const data = await Promise.resolve(1); data;",
                            new LinkedHashMap<String, Object>(),
                            BigInteger.valueOf(1000L)));
            assertTrue(error.getMessage().contains("Failed to evaluate code block"));
            assertTrue(error.code().contains("await"));
            assertEquals("SyntaxError", error.runtimeErrorName());
            assertTrue(error.runtimeErrorMessage() != null
                    && (error.runtimeErrorMessage().contains("await")
                    || error.runtimeErrorMessage().contains("expecting ';'")));
            assertTrue(error.runtimeStackAvailable());
            assertTrue(String.valueOf(error.runtimeStack()).contains("SyntaxError"));
        }
    }

    @Test
    void exposesStructuredRuntimeErrorMetadataOnWrappedFailure() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            CodeBlockEvaluationError error = assertThrows(
                    CodeBlockEvaluationError.class,
                    () -> evaluator.evaluate(
                            "throw new TypeError('bad input')",
                            new LinkedHashMap<String, Object>(),
                            BigInteger.valueOf(1000L)));
            assertEquals("TypeError", error.runtimeErrorName());
            assertEquals("bad input", error.runtimeErrorMessage());
            assertTrue(error.runtimeStackAvailable());
            assertTrue(String.valueOf(error.runtimeStack()).contains("TypeError: bad input"));
            assertNotNull(error.getCause());
            assertTrue(error.getCause() instanceof ScriptRuntimeException);
        }
    }

    @Test
    void exposesOutOfGasMetadataOnWrappedTimeoutFailures() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            CodeBlockEvaluationError error = assertThrows(
                    CodeBlockEvaluationError.class,
                    () -> evaluator.evaluate(
                            "while (true) {}",
                            new LinkedHashMap<String, Object>(),
                            BigInteger.ONE));
            assertEquals("OutOfGasError", error.runtimeErrorName());
            assertTrue(String.valueOf(error.runtimeErrorMessage()).contains("OutOfGas"));
        }
    }

    @Test
    void doesNotExposeDateOrProcessGlobals() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            ScriptRuntimeResult result = evaluator.evaluate(
                    "return ({ dateType: typeof Date, processType: typeof process });",
                    new LinkedHashMap<String, Object>(),
                    BigInteger.valueOf(1000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> value = (Map<String, Object>) result.value();
            assertEquals("undefined", String.valueOf(value.get("dateType")));
            assertEquals("undefined", String.valueOf(value.get("processType")));
        }
    }

    @Test
    void evaluatorCanBeReusedAcrossMultipleCalls() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            ScriptRuntimeResult first = evaluator.evaluate("return 1;", new LinkedHashMap<String, Object>(), BigInteger.valueOf(500L));
            ScriptRuntimeResult second = evaluator.evaluate("return 2;", new LinkedHashMap<String, Object>(), BigInteger.valueOf(500L));

            assertEquals("1", String.valueOf(first.value()));
            assertEquals("2", String.valueOf(second.value()));
        }
    }

    @Test
    void capturesEmitCallsInReturnedEnvelope() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            ScriptRuntimeResult result = evaluator.evaluate(
                    "emit({ kind: 'debug', value: 42 }); return 7;",
                    new LinkedHashMap<String, Object>(),
                    BigInteger.valueOf(1000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.value();
            assertEquals("7", String.valueOf(payload.get("__result")));
            assertTrue(payload.get("events") instanceof List);
            @SuppressWarnings("unchecked")
            List<Object> events = (List<Object>) payload.get("events");
            assertEquals(1, events.size());
        }
    }

    @Test
    void forwardsEmitCallsToHostBindingAndReturnsPlainResult() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            final List<Object> emissions = new ArrayList<Object>();
            Map<String, Object> bindings = new LinkedHashMap<String, Object>();
            bindings.put("emit", new Consumer<Object>() {
                @Override
                public void accept(Object value) {
                    emissions.add(value);
                }
            });

            ScriptRuntimeResult result = evaluator.evaluate(
                    "emit({ level: 'debug', message: 'hello', value: 42 }); return 7;",
                    bindings,
                    BigInteger.valueOf(1000L));

            assertEquals("7", String.valueOf(result.value()));
            assertTrue(result.valueDefined());
            assertEquals(1, emissions.size());
            assertTrue(emissions.get(0) instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> emitted = (Map<String, Object>) emissions.get(0);
            assertEquals("debug", String.valueOf(emitted.get("level")));
            assertEquals("42", String.valueOf(emitted.get("value")));
        }
    }

    @Test
    void forwardsEmitCallsWithUndefinedResultAsNoResult() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            final List<Object> emissions = new ArrayList<Object>();
            Map<String, Object> bindings = new LinkedHashMap<String, Object>();
            bindings.put("emit", new Consumer<Object>() {
                @Override
                public void accept(Object value) {
                    emissions.add(value);
                }
            });

            ScriptRuntimeResult result = evaluator.evaluate(
                    "emit({ level: 'debug', message: 'only-event' });",
                    bindings,
                    BigInteger.valueOf(1000L));

            assertNull(result.value());
            assertFalse(result.valueDefined());
            assertEquals(1, emissions.size());
            assertTrue(emissions.get(0) instanceof Map);
        }
    }

    @Test
    void distinguishesUndefinedFromExplicitNullResults() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            ScriptRuntimeResult explicitNull = evaluator.evaluate(
                    "return null;",
                    new LinkedHashMap<String, Object>(),
                    BigInteger.valueOf(1000L));
            ScriptRuntimeResult undefined = evaluator.evaluate(
                    "void 0",
                    new LinkedHashMap<String, Object>(),
                    BigInteger.valueOf(1000L));

            assertNull(explicitNull.value());
            assertTrue(explicitNull.valueDefined());
            assertNull(undefined.value());
            assertFalse(undefined.valueDefined());
        }
    }

    @Test
    void supportsFunctionDocumentBindingForPlainAndCanonicalReads() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Map<String, Object> bindings = new LinkedHashMap<String, Object>();
            bindings.put("document", new QuickJSEvaluator.DocumentBinding() {
                @Override
                public Object get(String pointer) {
                    if ("/unit".equals(pointer)) {
                        return "points";
                    }
                    return null;
                }

                @Override
                public Object getCanonical(String pointer) {
                    if ("/unit".equals(pointer)) {
                        return new LinkedHashMap<String, Object>() {{
                            put("value", "points");
                        }};
                    }
                    return null;
                }
            });

            ScriptRuntimeResult result = evaluator.evaluate(
                    "return ({ plain: document('/unit'), getAlias: document.get('/unit'), canonical: document.canonical('/unit').value, canonicalAlias: document.getCanonical('/unit').value });",
                    bindings,
                    BigInteger.valueOf(10000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.value();
            assertEquals("points", String.valueOf(payload.get("plain")));
            assertEquals("points", String.valueOf(payload.get("getAlias")));
            assertEquals("points", String.valueOf(payload.get("canonical")));
            assertEquals("points", String.valueOf(payload.get("canonicalAlias")));
        }
    }

    @Test
    void supportsSimpleFunctionDocumentBindingForLiteralPointers() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Map<String, Object> bindings = new LinkedHashMap<String, Object>();
            bindings.put("document", new Function<Object, Object>() {
                @Override
                public Object apply(Object pointer) {
                    if ("/total".equals(String.valueOf(pointer))) {
                        return 41;
                    }
                    return null;
                }
            });

            ScriptRuntimeResult result = evaluator.evaluate(
                    "return document('/total') + 1;",
                    bindings,
                    BigInteger.valueOf(1000L));

            assertEquals("42", String.valueOf(result.value()));
        }
    }

    @Test
    void supportsFunctionDocumentBindingForDynamicPointerExpressionsWhenRootSnapshotAvailable() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Map<String, Object> bindings = new LinkedHashMap<String, Object>();
            bindings.put("document", new QuickJSEvaluator.DocumentBinding() {
                @Override
                public Object get(String pointer) {
                    if ("/".equals(pointer)) {
                        return new LinkedHashMap<String, Object>() {{
                            put("total", 41);
                        }};
                    }
                    return null;
                }

                @Override
                public Object getCanonical(String pointer) {
                    if ("/".equals(pointer)) {
                        return new LinkedHashMap<String, Object>() {{
                            put("total", new LinkedHashMap<String, Object>() {{
                                put("value", 41);
                            }});
                        }};
                    }
                    return null;
                }
            });

            ScriptRuntimeResult result = evaluator.evaluate(
                    "const pointer = '/total'; return ({ plain: document(pointer), canonical: document.getCanonical(pointer).value });",
                    bindings,
                    BigInteger.valueOf(1000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.value();
            assertEquals("41", String.valueOf(payload.get("plain")));
            assertEquals("41", String.valueOf(payload.get("canonical")));
        }
    }

    @Test
    void resolvesRelativeDocumentPointersUsingScopePathBinding() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Map<String, Object> bindings = new LinkedHashMap<String, Object>();
            bindings.put("__scopePath", "/contracts/workflow");
            bindings.put("__documentDataSimple", new LinkedHashMap<String, Object>() {{
                put("contracts", new LinkedHashMap<String, Object>() {{
                    put("workflow", new LinkedHashMap<String, Object>() {{
                        put("counter", 5);
                    }});
                }});
            }});
            bindings.put("__documentDataCanonical", new LinkedHashMap<String, Object>() {{
                put("contracts", new LinkedHashMap<String, Object>() {{
                    put("workflow", new LinkedHashMap<String, Object>() {{
                        put("counter", new LinkedHashMap<String, Object>() {{
                            put("value", 5);
                        }});
                    }});
                }});
            }});

            ScriptRuntimeResult result = evaluator.evaluate(
                    "return ({ relative: document('counter'), absolute: document('/contracts/workflow/counter'), canonical: document.canonical('counter').value });",
                    bindings,
                    BigInteger.valueOf(10000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.value();
            assertEquals("5", String.valueOf(payload.get("relative")));
            assertEquals("5", String.valueOf(payload.get("absolute")));
            assertEquals("5", String.valueOf(payload.get("canonical")));
        }
    }

    @Test
    void providesDefaultBindingsWhenMissing() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            ScriptRuntimeResult result = evaluator.evaluate(
                    "return ({ eventIsNull: event === null, eventCanonicalIsNull: eventCanonical === null, " +
                            "stepsIsArray: Array.isArray(steps), stepsLength: steps.length, " +
                            "currentContractIsNull: currentContract === null, " +
                            "currentContractCanonicalIsNull: currentContractCanonical === null });",
                    new LinkedHashMap<String, Object>(),
                    BigInteger.valueOf(1000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> value = (Map<String, Object>) result.value();
            assertEquals(Boolean.TRUE, value.get("eventIsNull"));
            assertEquals(Boolean.TRUE, value.get("eventCanonicalIsNull"));
            assertEquals(Boolean.TRUE, value.get("stepsIsArray"));
            assertEquals("0", String.valueOf(value.get("stepsLength")));
            assertEquals(Boolean.TRUE, value.get("currentContractIsNull"));
            assertEquals(Boolean.TRUE, value.get("currentContractCanonicalIsNull"));
        }
    }

    @Test
    void fallsBackCanonicalBindingsToPlainBindingsWhenMissing() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Map<String, Object> bindings = new LinkedHashMap<>();
            bindings.put("event", new LinkedHashMap<String, Object>() {{
                put("payload", new LinkedHashMap<String, Object>() {{
                    put("id", "evt-456");
                }});
            }});
            bindings.put("currentContract", new LinkedHashMap<String, Object>() {{
                put("channel", "test");
            }});

            ScriptRuntimeResult result = evaluator.evaluate(
                    "return ({ eventId: eventCanonical.payload.id, contractChannel: currentContractCanonical.channel });",
                    bindings,
                    BigInteger.valueOf(1000L));

            assertTrue(result.value() instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> value = (Map<String, Object>) result.value();
            assertEquals("evt-456", String.valueOf(value.get("eventId")));
            assertEquals("test", String.valueOf(value.get("contractChannel")));
        }
    }

    @Test
    void rejectsUnsupportedBindingKeys() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            IllegalArgumentException thrown = assertThrows(
                    IllegalArgumentException.class,
                    () -> evaluator.evaluate(
                            "1",
                            new LinkedHashMap<String, Object>() {{
                                put("add", 1);
                            }},
                            BigInteger.valueOf(100L)));
            assertTrue(thrown.getMessage().contains("Unsupported QuickJS binding"));
        }
    }

    @Test
    void rejectsNonFunctionDocumentBinding() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            IllegalArgumentException thrown = assertThrows(
                    IllegalArgumentException.class,
                    () -> evaluator.evaluate(
                            "1",
                            new LinkedHashMap<String, Object>() {{
                                put("document", new LinkedHashMap<String, Object>());
                            }},
                            BigInteger.valueOf(100L)));
            assertTrue(thrown.getMessage().contains("document binding must be a function"));
        }
    }

    @Test
    void rejectsNonFunctionEmitBinding() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs evaluator tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            IllegalArgumentException thrown = assertThrows(
                    IllegalArgumentException.class,
                    () -> evaluator.evaluate(
                            "1",
                            new LinkedHashMap<String, Object>() {{
                                put("emit", Boolean.TRUE);
                            }},
                            BigInteger.valueOf(100L)));
            assertTrue(thrown.getMessage().contains("emit binding must be a function"));
        }
    }

    private boolean nodeAvailable() throws IOException, InterruptedException {
        Process process = new ProcessBuilder("node", "--version").start();
        int exit = process.waitFor();
        return exit == 0;
    }
}
