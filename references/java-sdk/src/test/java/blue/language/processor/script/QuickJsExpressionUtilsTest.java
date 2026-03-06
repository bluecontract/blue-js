package blue.language.processor.script;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class QuickJsExpressionUtilsTest {

    @Test
    void expressionHelpersDetectAndExtractExpressions() {
        assertTrue(QuickJsExpressionUtils.isExpression("${value}"));
        assertTrue(QuickJsExpressionUtils.isExpression("${foo({a: 1})}"));
        assertTrue(QuickJsExpressionUtils.isExpression("${line1 +\nline2}"));
        assertFalse(QuickJsExpressionUtils.isExpression("${foo} + ${bar}"));
        assertFalse(QuickJsExpressionUtils.isExpression("plain text"));

        assertTrue(QuickJsExpressionUtils.containsExpression("${value}"));
        assertTrue(QuickJsExpressionUtils.containsExpression("hello ${value} world"));
        assertTrue(QuickJsExpressionUtils.containsExpression("hello ${line1 +\nline2} world"));
        assertFalse(QuickJsExpressionUtils.containsExpression("hello world"));

        assertEquals("steps.answer", QuickJsExpressionUtils.extractExpressionContent("${steps.answer}"));
        assertThrows(IllegalArgumentException.class,
                () -> QuickJsExpressionUtils.extractExpressionContent("steps.answer"));
    }

    @Test
    void evaluatesExpressionsAndResolvesTemplates() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs expression tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Map<String, Object> bindings = new LinkedHashMap<>();
            Map<String, Object> steps = new LinkedHashMap<>();
            steps.put("value", 6);
            steps.put("factor", 7);
            bindings.put("steps", steps);
            Map<String, Object> document = new LinkedHashMap<>();
            document.put("unit", "points");
            bindings.put("__documentData", document);

            Object result = QuickJsExpressionUtils.evaluateQuickJsExpression(
                    evaluator,
                    "steps.value * steps.factor",
                    bindings,
                    null);
            assertEquals("42", String.valueOf(result));

            Object objectResult = QuickJsExpressionUtils.evaluateQuickJsExpression(
                    evaluator,
                    "{ answer: steps.value, nested: { factor: steps.factor } }",
                    bindings,
                    null);
            assertTrue(objectResult instanceof Map);
            @SuppressWarnings("unchecked")
            Map<String, Object> objectMap = (Map<String, Object>) objectResult;
            assertEquals("6", String.valueOf(objectMap.get("answer")));
            assertTrue(objectMap.get("nested") instanceof Map);

            String rendered = QuickJsExpressionUtils.resolveTemplateString(
                    evaluator,
                    "Hello ${steps.value}, total ${steps.value * steps.factor} ${document('/unit')}",
                    bindings,
                    null);
            assertEquals("Hello 6, total 42 points", rendered);

            String missing = QuickJsExpressionUtils.resolveTemplateString(
                    evaluator,
                    "Hello ${steps.missing}",
                    bindings,
                    null);
            assertEquals("Hello ", missing);
        }
    }

    @Test
    void resolveExpressionsUsesIncludeExcludePathPredicates() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs expression tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Node root = new Node()
                    .properties("keep", new Node().value("Value stays"))
                    .properties("direct", new Node().value("${steps.answer}"))
                    .properties("template", new Node().value("Total: ${steps.answer}"))
                    .properties("nested", new Node().items(Arrays.asList(
                            new Node().properties("flag", new Node().value("${steps.flag}")),
                            new Node().properties("flag", new Node().value("no substitution"))
                    )));

            Map<String, Object> bindings = new LinkedHashMap<>();
            Map<String, Object> steps = new LinkedHashMap<>();
            steps.put("answer", 42);
            steps.put("flag", "yes");
            bindings.put("steps", steps);

            final List<BigInteger> gasCharges = new ArrayList<>();
            QuickJsExpressionUtils.PointerPredicate shouldResolve = QuickJsExpressionUtils.createPathPredicate(
                    Arrays.asList("/direct", "/template", "/nested/**"),
                    Arrays.asList("/nested/1/**"));

            Node resolved = QuickJsExpressionUtils.resolveExpressions(
                    root,
                    evaluator,
                    bindings,
                    null,
                    shouldResolve,
                    null,
                    gasCharges::add);

            assertEquals("Value stays", resolved.getProperties().get("keep").getValue());
            assertEquals(new BigInteger("42"), resolved.getProperties().get("direct").getValue());
            assertEquals("Total: 42", resolved.getProperties().get("template").getValue());
            assertEquals("yes", resolved.getProperties().get("nested").getItems().get(0).getProperties().get("flag").getValue());
            assertEquals("no substitution", resolved.getProperties().get("nested").getItems().get(1).getProperties().get("flag").getValue());
            assertEquals("${steps.answer}", root.getProperties().get("direct").getValue());
            assertTrue(gasCharges.size() >= 2);
        }
    }

    @Test
    void resolveExpressionsChargesWasmGasFromEvaluatorUsage() {
        QuickJSEvaluator evaluator = new QuickJSEvaluator(new ScriptRuntime() {
            @Override
            public ScriptRuntimeResult evaluate(ScriptRuntimeRequest request) {
                return new ScriptRuntimeResult(7, BigInteger.valueOf(123L), BigInteger.ZERO, true);
            }

            @Override
            public void close() {
                // no-op
            }
        });
        try {
            Node root = new Node().properties("value", new Node().value("${steps.answer}"));
            List<BigInteger> gasCharges = new ArrayList<>();

            Node resolved = QuickJsExpressionUtils.resolveExpressions(
                    root,
                    evaluator,
                    new LinkedHashMap<String, Object>(),
                    null,
                    QuickJsExpressionUtils.createPathPredicate(Arrays.asList("/**"), null),
                    null,
                    gasCharges::add);

            assertEquals(new BigInteger("7"), resolved.getProperties().get("value").getValue());
            assertEquals(1, gasCharges.size());
            assertEquals(new BigInteger("123"), gasCharges.get(0));
        } finally {
            evaluator.close();
        }
    }

    @Test
    void wrapsEvaluationFailuresInCodeBlockEvaluationError() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs expression tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            CodeBlockEvaluationError error = assertThrows(
                    CodeBlockEvaluationError.class,
                    () -> QuickJsExpressionUtils.evaluateQuickJsExpression(
                            evaluator,
                            "invalid ?? expression",
                            new LinkedHashMap<String, Object>(),
                            null));
            assertTrue(error.getMessage().contains("Failed to evaluate code block"));
            assertTrue(error.getMessage().contains("invalid ?? expression"));
            assertEquals("invalid ?? expression", error.code());
        }
    }

    @Test
    void createPathPredicateSupportsIncludeExcludePatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/include/**"),
                Arrays.asList("/include/skip/**"));

        assertTrue(predicate.test("/include/path", null));
        assertFalse(predicate.test("/include/skip/here", null));
        assertFalse(predicate.test("/other", null));
    }

    @Test
    void createPathPredicateSupportsNoCaseAndNoGlobstarOptions() {
        QuickJsExpressionUtils.PointerPredicate nocasePredicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/include/**"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, true, false));
        assertTrue(nocasePredicate.test("/Include/Path", null));

        QuickJsExpressionUtils.PointerPredicate noGlobstarPredicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/include/**/item"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, true));
        assertTrue(noGlobstarPredicate.test("/include/path/item", null));
        assertFalse(noGlobstarPredicate.test("/include/path/deeper/item", null));
    }

    @Test
    void createPathPredicateDotOptionControlsHiddenSegments() {
        QuickJsExpressionUtils.PointerPredicate defaultPredicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/**"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));
        assertTrue(defaultPredicate.test("/.hidden", null));

        QuickJsExpressionUtils.PointerPredicate noDotPredicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/**"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(false, false, false));
        assertFalse(noDotPredicate.test("/.hidden", null));
        assertTrue(noDotPredicate.test("/visible", null));
        assertFalse(noDotPredicate.test("/visible/.hidden", null));
    }

    @Test
    void createPathPredicateDotOptionAllowsExplicitHiddenSegmentPatterns() {
        QuickJsExpressionUtils.PointerPredicate noDotPredicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/[.]hidden", "/**/[.]hidden"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(false, false, false));

        assertTrue(noDotPredicate.test("/.hidden", null));
        assertTrue(noDotPredicate.test("/visible/.hidden", null));
        assertFalse(noDotPredicate.test("/visible/.other", null));
    }

    @Test
    void createPathPredicateSupportsBraceExpansionPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/{primary,secondary}/**"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/primary/channel", null));
        assertTrue(predicate.test("/contracts/secondary/channel", null));
        assertFalse(predicate.test("/contracts/tertiary/channel", null));
    }

    @Test
    void createPathPredicateSupportsNestedBraceExpansionPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/a/{b,{c,d}}/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/a/b/value", null));
        assertTrue(predicate.test("/a/c/value", null));
        assertTrue(predicate.test("/a/d/value", null));
        assertFalse(predicate.test("/a/e/value", null));
    }

    @Test
    void createPathPredicateTreatsEscapedBracesAsLiterals() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/\\{a,b\\}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/{a,b}", null));
        assertFalse(predicate.test("/items/a", null));
        assertFalse(predicate.test("/items/b", null));
    }

    @Test
    void createPathPredicateSupportsBraceOptionsContainingParenthesizedCommas() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{alpha,@(beta,gamma)}/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/alpha/value", null));
        assertTrue(predicate.test("/items/beta,gamma/value", null));
        assertFalse(predicate.test("/items/beta/value", null));
    }

    @Test
    void createPathPredicateSupportsBraceOptionsContainingCharacterClassCommas() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{alpha,[a,b]}/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/alpha/value", null));
        assertTrue(predicate.test("/items/,/value", null));
        assertTrue(predicate.test("/items/a/value", null));
        assertFalse(predicate.test("/items/c/value", null));
    }

    @Test
    void createPathPredicateSupportsBraceOptionsContainingCharacterClassOpenParenAndComma() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{[(,],x}/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/(/value", null));
        assertTrue(predicate.test("/items/,/value", null));
        assertTrue(predicate.test("/items/x/value", null));
        assertFalse(predicate.test("/items/y/value", null));
    }

    @Test
    void createPathPredicateSupportsNumericBraceRanges() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{1..3}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/1", null));
        assertTrue(predicate.test("/items/2", null));
        assertTrue(predicate.test("/items/3", null));
        assertFalse(predicate.test("/items/4", null));
    }

    @Test
    void createPathPredicateSupportsNumericBraceRangesWithStep() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{1..7..3}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/1", null));
        assertTrue(predicate.test("/items/4", null));
        assertTrue(predicate.test("/items/7", null));
        assertFalse(predicate.test("/items/2", null));
        assertFalse(predicate.test("/items/6", null));
    }

    @Test
    void createPathPredicateSupportsDescendingNumericBraceRangesWithStep() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{7..1..3}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/7", null));
        assertTrue(predicate.test("/items/4", null));
        assertTrue(predicate.test("/items/1", null));
        assertFalse(predicate.test("/items/6", null));
        assertFalse(predicate.test("/items/2", null));
    }

    @Test
    void createPathPredicateSupportsNegativeNumericBraceRangesWithStep() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{-3..3..3}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/-3", null));
        assertTrue(predicate.test("/items/0", null));
        assertTrue(predicate.test("/items/3", null));
        assertFalse(predicate.test("/items/-2", null));
        assertFalse(predicate.test("/items/1", null));
    }

    @Test
    void createPathPredicateTreatsNegativeBraceRangeStepAsAbsoluteValue() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{1..7..-2}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/1", null));
        assertTrue(predicate.test("/items/3", null));
        assertTrue(predicate.test("/items/5", null));
        assertTrue(predicate.test("/items/7", null));
        assertFalse(predicate.test("/items/2", null));
        assertFalse(predicate.test("/items/6", null));
    }

    @Test
    void createPathPredicateSupportsAlphabeticBraceRanges() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{c..a}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/a", null));
        assertTrue(predicate.test("/items/b", null));
        assertTrue(predicate.test("/items/c", null));
        assertFalse(predicate.test("/items/d", null));
    }

    @Test
    void createPathPredicateSupportsDescendingAlphabeticBraceRangesWithStep() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{g..a..2}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/g", null));
        assertTrue(predicate.test("/items/e", null));
        assertTrue(predicate.test("/items/c", null));
        assertTrue(predicate.test("/items/a", null));
        assertFalse(predicate.test("/items/f", null));
        assertFalse(predicate.test("/items/b", null));
    }

    @Test
    void createPathPredicateSupportsAlphabeticBraceRangesWithStep() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{a..g..2}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/items/a", null));
        assertTrue(predicate.test("/items/c", null));
        assertTrue(predicate.test("/items/e", null));
        assertTrue(predicate.test("/items/g", null));
        assertFalse(predicate.test("/items/b", null));
        assertFalse(predicate.test("/items/f", null));
    }

    @Test
    void createPathPredicateDoesNotExpandZeroPaddedNumericRanges() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{01..03}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertFalse(predicate.test("/items/01", null));
        assertFalse(predicate.test("/items/02", null));
        assertFalse(predicate.test("/items/03", null));
    }

    @Test
    void createPathPredicateDoesNotExpandBraceRangesWithZeroStep() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/items/{1..3..0}"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertFalse(predicate.test("/items/1", null));
        assertFalse(predicate.test("/items/2", null));
        assertFalse(predicate.test("/items/3", null));
    }

    @Test
    void createPathPredicateSupportsCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[ab]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/a/value", null));
        assertTrue(predicate.test("/contracts/b/value", null));
        assertFalse(predicate.test("/contracts/c/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixAlphaCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:alpha:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/a/value", null));
        assertTrue(predicate.test("/contracts/Z/value", null));
        assertFalse(predicate.test("/contracts/3/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixDigitCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:digit:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/3/value", null));
        assertTrue(predicate.test("/contracts/9/value", null));
        assertFalse(predicate.test("/contracts/a/value", null));
    }

    @Test
    void createPathPredicateSupportsNegatedPosixDigitCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[![:digit:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/a/value", null));
        assertTrue(predicate.test("/contracts/Z/value", null));
        assertFalse(predicate.test("/contracts/3/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixHexDigitCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:xdigit:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/F/value", null));
        assertTrue(predicate.test("/contracts/a/value", null));
        assertTrue(predicate.test("/contracts/9/value", null));
        assertFalse(predicate.test("/contracts/G/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixAlnumCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:alnum:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/a/value", null));
        assertTrue(predicate.test("/contracts/7/value", null));
        assertFalse(predicate.test("/contracts/_/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixWordCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:word:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/a/value", null));
        assertTrue(predicate.test("/contracts/7/value", null));
        assertTrue(predicate.test("/contracts/_/value", null));
        assertFalse(predicate.test("/contracts/-/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixSpaceCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:space:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/ /value", null));
        assertTrue(predicate.test("/contracts/\t/value", null));
        assertFalse(predicate.test("/contracts/a/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixLowerCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:lower:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/a/value", null));
        assertTrue(predicate.test("/contracts/z/value", null));
        assertFalse(predicate.test("/contracts/A/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixUpperCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:upper:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/A/value", null));
        assertTrue(predicate.test("/contracts/Z/value", null));
        assertFalse(predicate.test("/contracts/a/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixBlankCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:blank:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/ /value", null));
        assertTrue(predicate.test("/contracts/\t/value", null));
        assertFalse(predicate.test("/contracts/\n/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixCntrlCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:cntrl:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/\n/value", null));
        assertTrue(predicate.test("/contracts/\t/value", null));
        assertFalse(predicate.test("/contracts/a/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixGraphCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:graph:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/A/value", null));
        assertTrue(predicate.test("/contracts/9/value", null));
        assertTrue(predicate.test("/contracts/!/value", null));
        assertFalse(predicate.test("/contracts/ /value", null));
    }

    @Test
    void createPathPredicateSupportsPosixPrintCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:print:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/ /value", null));
        assertTrue(predicate.test("/contracts/A/value", null));
        assertTrue(predicate.test("/contracts/!/value", null));
        assertFalse(predicate.test("/contracts/\n/value", null));
    }

    @Test
    void createPathPredicateSupportsPosixPunctCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[[:punct:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/!/value", null));
        assertTrue(predicate.test("/contracts/_/value", null));
        assertFalse(predicate.test("/contracts/A/value", null));
    }

    @Test
    void createPathPredicateSupportsNegatedPosixLowerCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[![:lower:]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/A/value", null));
        assertTrue(predicate.test("/contracts/7/value", null));
        assertFalse(predicate.test("/contracts/a/value", null));
    }

    @Test
    void createPathPredicateSupportsNegatedCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[!ab]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertFalse(predicate.test("/contracts/a/value", null));
        assertFalse(predicate.test("/contracts/b/value", null));
        assertTrue(predicate.test("/contracts/c/value", null));
    }

    @Test
    void createPathPredicateSupportsEscapedClosingBracketCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[\\]]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/]/value", null));
        assertFalse(predicate.test("/contracts/a/value", null));
        assertFalse(predicate.test("/contracts/\\/value", null));
    }

    @Test
    void createPathPredicateSupportsEscapedOpeningBracketCharacterClassPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[\\[]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/[/value", null));
        assertFalse(predicate.test("/contracts/a/value", null));
        assertFalse(predicate.test("/contracts/\\/value", null));
    }

    @Test
    void createPathPredicateSupportsCharacterClassesContainingBraceAndCommaLiterals() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/[{},x]/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/{/value", null));
        assertTrue(predicate.test("/contracts/}/value", null));
        assertTrue(predicate.test("/contracts/,/value", null));
        assertTrue(predicate.test("/contracts/x/value", null));
        assertFalse(predicate.test("/contracts/y/value", null));
    }

    @Test
    void createPathPredicateSupportsAtExtglobPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/@(primary|secondary)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/primary/value", null));
        assertTrue(predicate.test("/contracts/secondary/value", null));
        assertFalse(predicate.test("/contracts/tertiary/value", null));
    }

    @Test
    void createPathPredicateSupportsOptionalExtglobPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contract?(s)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contract/value", null));
        assertTrue(predicate.test("/contracts/value", null));
        assertFalse(predicate.test("/contractss/value", null));
    }

    @Test
    void createPathPredicateSupportsOneOrMoreExtglobPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contract+(s)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertFalse(predicate.test("/contract/value", null));
        assertTrue(predicate.test("/contracts/value", null));
        assertTrue(predicate.test("/contractss/value", null));
    }

    @Test
    void createPathPredicateSupportsZeroOrMoreExtglobPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contract*(s)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contract/value", null));
        assertTrue(predicate.test("/contracts/value", null));
        assertTrue(predicate.test("/contractss/value", null));
    }

    @Test
    void createPathPredicateSupportsNegatedExtglobPatterns() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/!(primary|secondary)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertFalse(predicate.test("/contracts/primary/value", null));
        assertFalse(predicate.test("/contracts/secondary/value", null));
        assertTrue(predicate.test("/contracts/tertiary/value", null));
    }

    @Test
    void createPathPredicateSupportsEscapedWildcardLiterals() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/\\*/value", "/contracts/\\?/label"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/*/value", null));
        assertTrue(predicate.test("/contracts/?/label", null));
        assertFalse(predicate.test("/contracts/x/value", null));
        assertFalse(predicate.test("/contracts/y/label", null));
    }

    @Test
    void createPathPredicateTreatsEscapedExtglobMarkerAsLiteral() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/\\@(primary|secondary)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/@(primary|secondary)/value", null));
        assertFalse(predicate.test("/contracts/primary/value", null));
    }

    @Test
    void createPathPredicateSupportsExtglobOptionsWithEscapedPipe() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/@(a\\|b|c)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/a|b/value", null));
        assertTrue(predicate.test("/contracts/c/value", null));
        assertFalse(predicate.test("/contracts/a/value", null));
    }

    @Test
    void createPathPredicateSupportsExtglobOptionsWithEscapedClosingParenthesis() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/@(a\\)|c)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/a)/value", null));
        assertTrue(predicate.test("/contracts/c/value", null));
        assertFalse(predicate.test("/contracts/a/value", null));
    }

    @Test
    void createPathPredicateSupportsExtglobCharacterClassOptionsContainingParentheses() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/@([()]|x)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/(/value", null));
        assertTrue(predicate.test("/contracts/)/value", null));
        assertTrue(predicate.test("/contracts/x/value", null));
        assertFalse(predicate.test("/contracts/y/value", null));
    }

    @Test
    void createPathPredicateSupportsExtglobCharacterClassOptionsContainingClosingParen() {
        QuickJsExpressionUtils.PointerPredicate predicate = QuickJsExpressionUtils.createPathPredicate(
                Arrays.asList("/contracts/@([)]|x)/value"),
                null,
                new QuickJsExpressionUtils.PathMatchOptions(true, false, false));

        assertTrue(predicate.test("/contracts/)/value", null));
        assertTrue(predicate.test("/contracts/x/value", null));
        assertFalse(predicate.test("/contracts/y/value", null));
    }

    @Test
    void resolveExpressionsHonorsShouldDescendPredicate() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs expression tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Node root = new Node()
                    .properties("resolve", new Node().value("${steps.answer}"))
                    .properties("literal", new Node()
                            .properties("nested", new Node().value("${steps.answer}")));

            Map<String, Object> bindings = new LinkedHashMap<>();
            Map<String, Object> steps = new LinkedHashMap<>();
            steps.put("answer", 42);
            bindings.put("steps", steps);

            Node resolved = QuickJsExpressionUtils.resolveExpressions(
                    root,
                    evaluator,
                    bindings,
                    null,
                    QuickJsExpressionUtils.createPathPredicate(Arrays.asList("/**"), null),
                    new QuickJsExpressionUtils.PointerPredicate() {
                        @Override
                        public boolean test(String pointer, Node node) {
                            return !"/literal".equals(pointer);
                        }
                    },
                    null);

            assertEquals(new BigInteger("42"), resolved.getProperties().get("resolve").getValue());
            assertEquals("${steps.answer}", resolved.getProperties().get("literal").getProperties().get("nested").getValue());
        }
    }

    @Test
    void resolveExpressionsSkipsCurrentNodeWhenShouldDescendRejectsPointer() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs expression tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Node root = new Node().value("${steps.answer}");

            Map<String, Object> bindings = new LinkedHashMap<>();
            Map<String, Object> steps = new LinkedHashMap<>();
            steps.put("answer", 42);
            bindings.put("steps", steps);

            Node resolved = QuickJsExpressionUtils.resolveExpressions(
                    root,
                    evaluator,
                    bindings,
                    null,
                    QuickJsExpressionUtils.createPathPredicate(Arrays.asList("/**"), null),
                    new QuickJsExpressionUtils.PointerPredicate() {
                        @Override
                        public boolean test(String pointer, Node node) {
                            return false;
                        }
                    },
                    null);

            assertEquals("${steps.answer}", resolved.getValue());
        }
    }

    @Test
    void resolveExpressionsInvokesShouldDescendWithRootPointer() throws IOException, InterruptedException {
        assumeTrue(nodeAvailable(), "Node.js binary is required for quickjs expression tests");

        try (QuickJSEvaluator evaluator = new QuickJSEvaluator()) {
            Node root = new Node().value("no expression");
            AtomicReference<String> firstPointer = new AtomicReference<String>();
            Node resolved = QuickJsExpressionUtils.resolveExpressions(
                    root,
                    evaluator,
                    new LinkedHashMap<String, Object>(),
                    null,
                    QuickJsExpressionUtils.createPathPredicate(Arrays.asList("/**"), null),
                    new QuickJsExpressionUtils.PointerPredicate() {
                        @Override
                        public boolean test(String pointer, Node node) {
                            if (firstPointer.get() == null) {
                                firstPointer.set(pointer);
                            }
                            return true;
                        }
                    },
                    null);

            assertEquals("no expression", resolved.getValue());
            assertEquals("/", firstPointer.get());
        }
    }

    private boolean nodeAvailable() throws IOException, InterruptedException {
        Process process = new ProcessBuilder("node", "--version").start();
        int exit = process.waitFor();
        return exit == 0;
    }
}
