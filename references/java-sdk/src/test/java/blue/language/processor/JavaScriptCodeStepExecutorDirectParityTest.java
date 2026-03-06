package blue.language.processor;

import blue.language.Blue;
import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.processor.model.SequentialWorkflow;
import blue.language.processor.script.CodeBlockEvaluationError;
import blue.language.processor.workflow.StepExecutionArgs;
import blue.language.processor.workflow.WorkflowStepExecutor;
import blue.language.processor.workflow.steps.JavaScriptCodeStepExecutor;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JavaScriptCodeStepExecutorDirectParityTest {

    @Test
    void executesStepDirectlyAndChargesWasmGas() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();

        Node document = new Node().properties("counter", new Node().value(5));
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");

        Node event = new Node()
                .type(new Node().blueId("TestEvent"))
                .properties("x", new Node().value(7));
        Node step = new Node()
                .name("Compute")
                .type(new Node().blueId("Conversation/JavaScript Code"))
                .properties("code", new Node().value("return { result: document('/counter') + event.x };"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);

        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        long beforeGas = execution.runtime().totalGas();
        Object result = executor.execute(args);
        long afterGas = execution.runtime().totalGas();

        assertTrue(result instanceof Map);
        @SuppressWarnings("unchecked")
        Map<String, Object> resultMap = (Map<String, Object>) result;
        assertEquals("12", String.valueOf(resultMap.get("result")));
        assertTrue(afterGas > beforeGas);
    }

    @Test
    void throwsFatalWhenStepSchemaIsInvalid() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("WrongStepType")
                .type(new Node().blueId("Conversation/Trigger Event"))
                .properties("code", new Node().value("return 1;"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        ProcessorFatalException fatal = assertThrows(ProcessorFatalException.class, () -> executor.execute(args));
        assertTrue(String.valueOf(fatal.getMessage()).contains("step payload is invalid"));
    }

    @Test
    void throwsFatalWhenCodePayloadIsMissing() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("MissingCode")
                .type(new Node().blueId("Conversation/JavaScript Code"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        ProcessorFatalException fatal = assertThrows(ProcessorFatalException.class, () -> executor.execute(args));
        assertTrue(String.valueOf(fatal.getMessage()).contains("requires non-empty code"));
    }

    @Test
    void wrapsThrownScriptErrorsInCodeBlockEvaluationError() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("ThrowingStep")
                .type(new Node().blueId("Conversation/JavaScript Code"))
                .properties("code", new Node().value("throw new TypeError('bad input');"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        CodeBlockEvaluationError error = assertThrows(CodeBlockEvaluationError.class, () -> executor.execute(args));
        assertEquals("TypeError", error.runtimeErrorName());
        assertEquals("bad input", error.runtimeErrorMessage());
    }

    @Test
    void enforcesGasLimitsForRunawayDirectExecution() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Runaway")
                .type(new Node().blueId("Conversation/JavaScript Code"))
                .properties("code", new Node().value("while (true) {}"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        CodeBlockEvaluationError error = assertThrows(CodeBlockEvaluationError.class, () -> executor.execute(args));
        assertEquals("OutOfGasError", error.runtimeErrorName());
        assertTrue(String.valueOf(error.runtimeErrorMessage()).contains("OutOfGas"));
    }

    @Test
    void doesNotExposeDateOrProcessInDirectExecution() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("DeterministicGlobals")
                .type(new Node().blueId("Conversation/JavaScript Code"))
                .properties("code", new Node().value("return { dateType: typeof Date, processType: typeof process };"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        Object result = executor.execute(args);
        assertTrue(result instanceof Map);
        @SuppressWarnings("unchecked")
        Map<String, Object> resultMap = (Map<String, Object>) result;
        assertEquals("undefined", String.valueOf(resultMap.get("dateType")));
        assertEquals("undefined", String.valueOf(resultMap.get("processType")));
    }

    @Test
    void returnsNoResultForUndefinedCodeResult() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("UndefinedResult")
                .type(new Node().blueId("Conversation/JavaScript Code"))
                .properties("code", new Node().value("const ignored = 1;"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        Object result = executor.execute(args);
        assertTrue(result == WorkflowStepExecutor.NO_RESULT);
    }

    @Test
    void preservesExplicitNullCodeResult() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("NullResult")
                .type(new Node().blueId("Conversation/JavaScript Code"))
                .properties("code", new Node().value("return null;"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        Object result = executor.execute(args);
        assertNull(result);
    }

    @Test
    void acceptsProviderDerivedStepTypeBlueId() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived JavaScript Code".equals(blueId)) {
                return java.util.Collections.emptyList();
            }
            Node definition = new Node().type(new Node().blueId("Conversation/JavaScript Code"));
            return java.util.Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("DerivedStep")
                .type(new Node().blueId("Custom/Derived JavaScript Code"))
                .properties("code", new Node().value("return { value: 21 * 2 };"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        Object result = executor.execute(args);
        assertTrue(result instanceof Map);
        @SuppressWarnings("unchecked")
        Map<String, Object> resultMap = (Map<String, Object>) result;
        assertEquals("42", String.valueOf(resultMap.get("value")));
    }

    @Test
    void acceptsProviderDerivedStepTypeBlueIdFromDefinitionValue() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived JavaScript Code".equals(blueId)) {
                return java.util.Collections.emptyList();
            }
            Node definition = new Node().value("Conversation/JavaScript Code");
            return java.util.Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("DerivedStep")
                .type(new Node().blueId("Custom/Derived JavaScript Code"))
                .properties("code", new Node().value("return { value: 9 * 5 };"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        Object result = executor.execute(args);
        assertTrue(result instanceof Map);
        @SuppressWarnings("unchecked")
        Map<String, Object> resultMap = (Map<String, Object>) result;
        assertEquals("45", String.valueOf(resultMap.get("value")));
    }

    @Test
    void acceptsProviderDerivedStepTypeBlueIdFromDefinitionProperty() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived JavaScript Code".equals(blueId)) {
                return java.util.Collections.emptyList();
            }
            Node definition = new Node().properties("blueId", new Node().value("Conversation/JavaScript Code"));
            return java.util.Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("DerivedStep")
                .type(new Node().blueId("Custom/Derived JavaScript Code"))
                .properties("code", new Node().value("return { value: 4 * 8 };"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0);

        Object result = executor.execute(args);
        assertTrue(result instanceof Map);
        @SuppressWarnings("unchecked")
        Map<String, Object> resultMap = (Map<String, Object>) result;
        assertEquals("32", String.valueOf(resultMap.get("value")));
    }

    @Test
    void usesExplicitContractNodeBindingsWhenProvided() {
        JavaScriptCodeStepExecutor executor = new JavaScriptCodeStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("ContractNodeBindings")
                .type(new Node().blueId("Conversation/JavaScript Code"))
                .properties("code", new Node().value(
                        "return { simple: currentContract.channel, canonical: currentContractCanonical.channel.value };"));
        Node contractNode = new Node()
                .description("Provided Contract")
                .type(new Node().blueId("Conversation/Sequential Workflow"))
                .properties("channel", new Node().value("provided-channel"));

        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        StepExecutionArgs args = new StepExecutionArgs(
                new SequentialWorkflow(),
                step,
                event,
                context,
                new LinkedHashMap<String, Object>(),
                0,
                contractNode);

        Object result = executor.execute(args);
        assertTrue(result instanceof Map);
        @SuppressWarnings("unchecked")
        Map<String, Object> resultMap = (Map<String, Object>) result;
        assertEquals("provided-channel", String.valueOf(resultMap.get("simple")));
        assertEquals("provided-channel", String.valueOf(resultMap.get("canonical")));
    }
}
