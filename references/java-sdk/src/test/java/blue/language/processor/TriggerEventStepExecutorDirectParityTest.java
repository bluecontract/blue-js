package blue.language.processor;

import blue.language.Blue;
import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.processor.model.SequentialWorkflow;
import blue.language.processor.workflow.StepExecutionArgs;
import blue.language.processor.workflow.steps.TriggerEventStepExecutor;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TriggerEventStepExecutorDirectParityTest {

    @Test
    void emitsResolvedEventPayloadAndChargesTriggerGas() {
        TriggerEventStepExecutor executor = new TriggerEventStepExecutor();

        Node document = new Node();
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");

        Node event = new Node()
                .type(new Node().blueId("TestEvent"))
                .properties("kind", new Node().value("from-event"));
        Node step = new Node()
                .name("Emit")
                .type(new Node().blueId("Conversation/Trigger Event"))
                .properties("event", new Node()
                        .properties("type", new Node().blueId("Conversation/Chat Message"))
                        .properties("message", new Node().value("${event.kind}")));

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
        executor.execute(args);
        long afterGas = execution.runtime().totalGas();

        Node emitted = execution.runtime().scope("/").triggeredQueue().peekFirst();
        assertNotNull(emitted);
        assertEquals("from-event", String.valueOf(emitted.getProperties().get("message").getValue()));
        assertTrue(afterGas > beforeGas);
    }

    @Test
    void preservesNestedDocumentExpressionsInEmittedPayload() {
        TriggerEventStepExecutor executor = new TriggerEventStepExecutor();

        Node document = new Node();
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Emit")
                .type(new Node().blueId("Conversation/Trigger Event"))
                .properties("event", new Node()
                        .properties("type", new Node().blueId("Conversation/Chat Message"))
                        .properties("document", new Node()
                                .properties("contracts", new Node().properties("x", new Node()))
                                .properties("counterExpr", new Node().value("${document('/counter') + 1}"))));

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

        executor.execute(args);

        Node emitted = execution.runtime().scope("/").triggeredQueue().peekFirst();
        assertNotNull(emitted);
        Node preserved = emitted.getProperties()
                .get("document")
                .getProperties()
                .get("counterExpr");
        assertEquals("${document('/counter') + 1}", String.valueOf(preserved.getValue()));
    }

    @Test
    void throwsFatalWhenEventPayloadIsMissing() {
        TriggerEventStepExecutor executor = new TriggerEventStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Emit")
                .type(new Node().blueId("Conversation/Trigger Event"));

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

        assertThrows(ProcessorFatalException.class, () -> executor.execute(args));
    }

    @Test
    void throwsFatalWhenStepSchemaIsInvalid() {
        TriggerEventStepExecutor executor = new TriggerEventStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("WrongStepType")
                .type(new Node().blueId("Conversation/JavaScript Code"))
                .properties("event", new Node()
                        .properties("kind", new Node().value("should-not-emit")));

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
    void acceptsProviderDerivedStepTypeBlueId() {
        TriggerEventStepExecutor executor = new TriggerEventStepExecutor();
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Trigger Event".equals(blueId)) {
                return java.util.Collections.emptyList();
            }
            Node definition = new Node().type(new Node().blueId("Conversation/Trigger Event"));
            return java.util.Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Emit")
                .type(new Node().blueId("Custom/Derived Trigger Event"))
                .properties("event", new Node()
                        .properties("kind", new Node().value("derived-step")));

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

        executor.execute(args);

        Node emitted = execution.runtime().scope("/").triggeredQueue().peekFirst();
        assertNotNull(emitted);
        assertEquals("derived-step", String.valueOf(emitted.getProperties().get("kind").getValue()));
    }

    @Test
    void acceptsProviderDerivedStepTypeBlueIdFromDefinitionValue() {
        TriggerEventStepExecutor executor = new TriggerEventStepExecutor();
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Trigger Event".equals(blueId)) {
                return java.util.Collections.emptyList();
            }
            Node definition = new Node().value("Conversation/Trigger Event");
            return java.util.Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Emit")
                .type(new Node().blueId("Custom/Derived Trigger Event"))
                .properties("event", new Node()
                        .properties("kind", new Node().value("derived-step-value")));

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

        executor.execute(args);

        Node emitted = execution.runtime().scope("/").triggeredQueue().peekFirst();
        assertNotNull(emitted);
        assertEquals("derived-step-value", String.valueOf(emitted.getProperties().get("kind").getValue()));
    }

    @Test
    void acceptsProviderDerivedStepTypeBlueIdFromDefinitionProperty() {
        TriggerEventStepExecutor executor = new TriggerEventStepExecutor();
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Trigger Event".equals(blueId)) {
                return java.util.Collections.emptyList();
            }
            Node definition = new Node().properties("blueId", new Node().value("Conversation/Trigger Event"));
            return java.util.Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Emit")
                .type(new Node().blueId("Custom/Derived Trigger Event"))
                .properties("event", new Node()
                        .properties("kind", new Node().value("derived-step-property")));

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

        executor.execute(args);

        Node emitted = execution.runtime().scope("/").triggeredQueue().peekFirst();
        assertNotNull(emitted);
        assertEquals("derived-step-property", String.valueOf(emitted.getProperties().get("kind").getValue()));
    }
}
