package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.model.JsonPatch;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Focused tests for the slim handler context surface.
 */
final class ProcessorExecutionContextTest {

    @Test
    void applyPatchMutatesDocumentWhenScopeIsActive() {
        Node document = new Node().properties("child", new Node());
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");

        ProcessorExecutionContext context = execution.createContext(
                "/child",
                ContractBundle.empty(),
                new Node(),
                false,
                false);

        context.applyPatch(JsonPatch.add("/child/value", new Node().value(7)));

        Node value = context.documentAt("/child/value");
        assertNotNull(value);
        assertEquals(7, Integer.parseInt(String.valueOf(value.getValue())));
    }

    @Test
    void applyPatchSkipsWhenScopeInactiveUnlessAllowed() {
        Node document = new Node().properties("child", new Node());
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        execution.runtime().scope("/child")
                .finalizeTermination(ScopeRuntimeContext.TerminationKind.GRACEFUL, "done");

        ProcessorExecutionContext blocked = execution.createContext(
                "/child",
                ContractBundle.empty(),
                new Node(),
                false,
                false);
        blocked.applyPatch(JsonPatch.add("/child/value", new Node().value(1)));
        assertNull(blocked.documentAt("/child/value"));

        ProcessorExecutionContext allowed = execution.createContext(
                "/child",
                ContractBundle.empty(),
                new Node(),
                true,
                false);
        allowed.applyPatch(JsonPatch.add("/child/value", new Node().value(2)));
        assertEquals(2, Integer.parseInt(String.valueOf(allowed.documentAt("/child/value").getValue())));
    }

    @Test
    void documentHelpersExposeSnapshots() {
        Node document = new Node()
                .properties("value", new Node().value(1))
                .properties("nested", new Node().properties("inner", new Node().value("x")));

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");

        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        Node snapshot = context.documentAt("/nested/inner");
        assertNotNull(snapshot);
        assertEquals("x", snapshot.getValue());

        Node missing = context.documentAt("/unknown");
        assertNull(missing);

        assertTrue(context.documentContains("/value"));
        assertFalse(context.documentContains("/value/missing"));
        assertFalse(context.documentContains("/items/-"));

        // Ensure the returned node is a clone (mutation should not leak back).
        snapshot.value("mutated");
        Node reread = context.documentAt("/nested/inner");
        assertEquals("x", reread.getValue());
    }

    @Test
    void emitEventQueuesAndChargesGas() {
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        context.emitEvent(new Node().value("payload"));

        ScopeRuntimeContext scopeRuntime = execution.runtime().scope("/");
        assertEquals(1, scopeRuntime.triggeredQueue().size());
        assertEquals(1, execution.runtime().rootEmissions().size());
        assertTrue(execution.runtime().totalGas() >= 20L);
    }

    @Test
    void consumeGasAddsUnitsToRuntime() {
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        context.consumeGas(42);

        assertEquals(42L, execution.runtime().totalGas());
    }

    @Test
    void terminationMethodsDelegateToExecutionTerminationService() {
        DocumentProcessor owner = new DocumentProcessor();

        ProcessorEngine.Execution gracefulExecution = new ProcessorEngine.Execution(owner, new Node());
        gracefulExecution.loadBundles("/");
        ProcessorExecutionContext graceful = gracefulExecution.createContext(
                "/child",
                ContractBundle.empty(),
                new Node(),
                true,
                false);
        graceful.terminateGracefully("done");
        ScopeRuntimeContext gracefulScope = gracefulExecution.runtime().scope("/child");
        assertTrue(gracefulScope.isTerminated());
        assertEquals(ScopeRuntimeContext.TerminationKind.GRACEFUL, gracefulScope.terminationKind());
        assertEquals("done", gracefulScope.terminationReason());

        ProcessorEngine.Execution fatalExecution = new ProcessorEngine.Execution(owner, new Node());
        fatalExecution.loadBundles("/");
        ProcessorExecutionContext fatal = fatalExecution.createContext(
                "/child",
                ContractBundle.empty(),
                new Node(),
                true,
                false);
        fatal.terminateFatally("fatal");
        ScopeRuntimeContext fatalScope = fatalExecution.runtime().scope("/child");
        assertTrue(fatalScope.isTerminated());
        assertEquals(ScopeRuntimeContext.TerminationKind.FATAL, fatalScope.terminationKind());
        assertEquals("fatal", fatalScope.terminationReason());
    }

    @Test
    void documentHelpersSupportEscapedAndListPointers() {
        Node document = new Node()
                .properties("a/b", new Node().value("slash"))
                .properties("list", new Node().items(
                        new Node().value("zero"),
                        new Node().value("one")))
                .properties("box", new Node().properties("01", new Node().value("leading-zero")));

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertEquals("slash", context.documentAt("/a~1b").getValue());
        assertEquals("one", context.documentAt("/list/1").getValue());
        assertTrue(context.documentContains("/box/01"));
        assertFalse(context.documentContains("/list/01"));
    }

    @Test
    void documentHelpersSupportBuiltInTypeAndBluePointers() {
        Node document = new Node()
                .type(new Node().name("TypeRoot"))
                .blue(new Node().name("BlueRoot"))
                .properties("type", new Node().value("property-type"));

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertEquals("property-type", context.documentAt("/type").getValue());
        assertEquals("BlueRoot", context.documentAt("/blue").getName());
    }

    @Test
    void documentHelpersReturnNullOrFalseForMalformedEscapedPointers() {
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node().properties("x", new Node().value("y")));
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertNull(context.documentAt("/x~"));
        assertFalse(context.documentContains("/x~2"));
    }

    @Test
    void documentHelpersSupportTrailingEmptyPropertySegments() {
        Node document = new Node()
                .properties("scope", new Node().properties("", new Node().value("empty-key")));

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertEquals("empty-key", context.documentAt("/scope/").getValue());
        assertTrue(context.documentContains("/scope/"));
    }

    @Test
    void documentHelpersPreferNumericPropertyOverListIndex() {
        Node document = new Node()
                .properties("list", new Node()
                        .items(new Node().value("index-zero"))
                        .properties("0", new Node().value("property-zero")));

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertEquals("property-zero", context.documentAt("/list/0").getValue());
    }

    @Test
    void documentHelpersFallBackToArrayIndexWhenMixedParentHasNoNumericPropertyMatch() {
        Node document = new Node()
                .properties("list", new Node()
                        .items(new Node().value("index-zero"), new Node().value("index-one"))
                        .properties("existing", new Node().value("keep")));

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertEquals("index-one", context.documentAt("/list/1").getValue());
        assertEquals("keep", context.documentAt("/list/existing").getValue());
    }

    @Test
    void documentHelpersUseLeadingZeroNumericPropertyWhenMixedParentHasPropertyMap() {
        Node document = new Node()
                .properties("list", new Node()
                        .items(new Node().value("index-zero"), new Node().value("index-one"))
                        .properties("01", new Node().value("property-leading-zero")));

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertEquals("property-leading-zero", context.documentAt("/list/01").getValue());
        assertEquals("index-one", context.documentAt("/list/1").getValue());
    }

    @Test
    void documentHelpersTreatEmptyPointerAsMissingPath() {
        Node document = new Node()
                .properties("value", new Node().value(1));

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertNull(context.documentAt(""));
        assertFalse(context.documentContains(""));
    }

    @Test
    void documentHelpersTreatNullPointerAsMissingPath() {
        Node document = new Node()
                .properties("value", new Node().value(1));

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertNull(context.documentAt(null));
        assertFalse(context.documentContains(null));
    }

    @Test
    void documentHelpersNormalizeNonPointerPaths() {
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node().properties("x", new Node().value("y")));
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertEquals("y", context.documentAt("x").getValue());
        assertTrue(context.documentContains("x"));
    }

    @Test
    void resolvePointerTreatsNullAndEmptyAsScopeRoot() {
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertEquals("/", context.resolvePointer(null));
        assertEquals("/", context.resolvePointer(""));
    }

    @Test
    void resolvePointerNormalizesNonPointerInputs() {
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);

        assertEquals("/child", context.resolvePointer("child"));
    }

    @Test
    void bundleLookupTreatsNullAndEmptyScopeAsRoot() {
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        ContractBundle root = execution.bundleForScope("/");
        assertNotNull(root);
        assertSame(root, execution.bundleForScope(""));
        assertSame(root, execution.bundleForScope(null));
    }
}
