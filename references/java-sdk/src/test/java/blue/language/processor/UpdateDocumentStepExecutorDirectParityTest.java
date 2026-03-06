package blue.language.processor;

import blue.language.Blue;
import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.processor.model.SequentialWorkflow;
import blue.language.processor.script.CodeBlockEvaluationError;
import blue.language.processor.workflow.StepExecutionArgs;
import blue.language.processor.workflow.steps.UpdateDocumentStepExecutor;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UpdateDocumentStepExecutorDirectParityTest {

    @Test
    void appliesResolvedChangesAndChargesBaseGas() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();

        Node document = new Node().properties("counter", new Node().value(5));
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");

        Node event = new Node()
                .type(new Node().blueId("TestEvent"))
                .properties("x", new Node().value(2));
        Node step = new Node()
                .name("Apply")
                .type(new Node().blueId("Conversation/Update Document"))
                .properties("changeset", new Node().items(
                        new Node().properties("op", new Node().value("REPLACE"))
                                .properties("path", new Node().value("/counter"))
                                .properties("val", new Node().value("${document('/counter') + event.x}"))
                ));

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

        Node counter = context.documentAt("/counter");
        assertNotNull(counter);
        assertEquals("7", String.valueOf(counter.getValue()));
        assertTrue(afterGas > beforeGas);
    }

    @Test
    void supportsExpressionChangesetArraysInDirectExecution() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();

        Node document = new Node();
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Apply")
                .type(new Node().blueId("Conversation/Update Document"))
                .properties("changeset", new Node().value("${[{ op: 'ADD', path: '/status', val: 'ready' }]}"));

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

        Node status = context.documentAt("/status");
        assertNotNull(status);
        assertEquals("ready", String.valueOf(status.getValue()));
    }

    @Test
    void appliesStaticAddAndRemoveOperationsInDirectExecution() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();

        Node document = new Node()
                .properties("status", new Node().value("stale"))
                .properties("obsolete", new Node().value("remove-me"));
        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Apply")
                .type(new Node().blueId("Conversation/Update Document"))
                .properties("changeset", new Node().items(
                        new Node().properties("op", new Node().value("ADD"))
                                .properties("path", new Node().value("/added"))
                                .properties("val", new Node().value("fresh")),
                        new Node().properties("op", new Node().value("REMOVE"))
                                .properties("path", new Node().value("/obsolete"))
                ));

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

        Node added = context.documentAt("/added");
        Node obsolete = context.documentAt("/obsolete");
        assertNotNull(added);
        assertEquals("fresh", String.valueOf(added.getValue()));
        assertTrue(obsolete == null);
    }

    @Test
    void throwsFatalForUnsupportedPatchOperationsInDirectExecution() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Apply")
                .type(new Node().blueId("Conversation/Update Document"))
                .properties("changeset", new Node().items(
                        new Node().properties("op", new Node().value("UPSERT"))
                                .properties("path", new Node().value("/status"))
                                .properties("val", new Node().value("ready"))
                ));

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
    void wrapsPathEvaluationErrorsInCodeBlockEvaluationError() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Apply")
                .type(new Node().blueId("Conversation/Update Document"))
                .properties("changeset", new Node().items(
                        new Node().properties("op", new Node().value("REPLACE"))
                                .properties("path", new Node().value("${doesNotExist.value}"))
                                .properties("val", new Node().value("hi"))
                ));

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

        assertThrows(CodeBlockEvaluationError.class, () -> executor.execute(args));
    }

    @Test
    void throwsFatalWhenPathIsNotString() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Apply")
                .type(new Node().blueId("Conversation/Update Document"))
                .properties("changeset", new Node().items(
                        new Node().properties("op", new Node().value("REPLACE"))
                                .properties("path", new Node().value(7))
                                .properties("val", new Node().value("hi"))
                ));

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
        assertTrue(String.valueOf(fatal.getMessage()).contains("requires a non-empty path"));
    }

    @Test
    void acceptsProviderDerivedStepTypeBlueId() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Update Document".equals(blueId)) {
                return java.util.Collections.emptyList();
            }
            Node definition = new Node().type(new Node().blueId("Conversation/Update Document"));
            return java.util.Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node().properties("counter", new Node().value(0)));
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Apply")
                .type(new Node().blueId("Custom/Derived Update Document"))
                .properties("changeset", new Node().items(
                        new Node().properties("op", new Node().value("REPLACE"))
                                .properties("path", new Node().value("/counter"))
                                .properties("val", new Node().value(3))
                ));

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

        assertEquals("3", String.valueOf(context.documentAt("/counter").getValue()));
    }

    @Test
    void acceptsProviderDerivedStepTypeBlueIdFromDefinitionValue() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Update Document".equals(blueId)) {
                return java.util.Collections.emptyList();
            }
            Node definition = new Node().value("Conversation/Update Document");
            return java.util.Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node().properties("counter", new Node().value(0)));
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Apply")
                .type(new Node().blueId("Custom/Derived Update Document"))
                .properties("changeset", new Node().items(
                        new Node().properties("op", new Node().value("REPLACE"))
                                .properties("path", new Node().value("/counter"))
                                .properties("val", new Node().value(5))
                ));

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

        assertEquals("5", String.valueOf(context.documentAt("/counter").getValue()));
    }

    @Test
    void acceptsProviderDerivedStepTypeBlueIdFromDefinitionProperty() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Update Document".equals(blueId)) {
                return java.util.Collections.emptyList();
            }
            Node definition = new Node().properties("blueId", new Node().value("Conversation/Update Document"));
            return java.util.Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node().properties("counter", new Node().value(0)));
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("Apply")
                .type(new Node().blueId("Custom/Derived Update Document"))
                .properties("changeset", new Node().items(
                        new Node().properties("op", new Node().value("REPLACE"))
                                .properties("path", new Node().value("/counter"))
                                .properties("val", new Node().value(8))
                ));

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

        assertEquals("8", String.valueOf(context.documentAt("/counter").getValue()));
    }

    @Test
    void throwsFatalWhenStepSchemaIsInvalid() {
        UpdateDocumentStepExecutor executor = new UpdateDocumentStepExecutor();

        DocumentProcessor owner = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        Node event = new Node().type(new Node().blueId("TestEvent"));
        Node step = new Node()
                .name("WrongStepType")
                .type(new Node().blueId("Conversation/JavaScript Code"))
                .properties("changeset", new Node().items(
                        new Node().properties("op", new Node().value("REPLACE"))
                                .properties("path", new Node().value("/status"))
                                .properties("val", new Node().value("ready"))
                ));

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
}
