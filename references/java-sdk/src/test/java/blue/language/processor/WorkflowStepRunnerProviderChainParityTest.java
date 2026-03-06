package blue.language.processor;

import blue.language.Blue;
import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.processor.model.SequentialWorkflow;
import blue.language.processor.workflow.StepExecutionArgs;
import blue.language.processor.workflow.WorkflowStepExecutor;
import blue.language.processor.workflow.WorkflowStepRunner;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class WorkflowStepRunnerProviderChainParityTest {

    @Test
    void runResolvesProviderDerivedStepTypeChainsFromDefinitionValue() {
        WorkflowStepExecutor executor = new WorkflowStepExecutor() {
            @Override
            public Set<String> supportedBlueIds() {
                return Collections.unmodifiableSet(new LinkedHashSet<String>(Collections.singletonList("Step/Only")));
            }

            @Override
            public Object execute(StepExecutionArgs args) {
                return "ok";
            }
        };

        NodeProvider provider = blueId -> {
            if (!"Step/Derived".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node().value("Step/Only");
            return Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        WorkflowStepRunner runner = new WorkflowStepRunner(Collections.singletonList(executor));
        Node event = new Node().type(new Node().blueId("TestEvent"));
        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        Node derived = new Node().type(new Node().blueId("Step/Derived"));

        Map<String, Object> results = runner.run(
                new SequentialWorkflow(),
                Collections.singletonList(derived),
                event,
                context);

        assertEquals(1, results.size());
        assertEquals("ok", results.get("Step1"));
    }

    @Test
    void runResolvesProviderDerivedStepTypeChainsFromDefinitionPropertyBlueId() {
        WorkflowStepExecutor executor = new WorkflowStepExecutor() {
            @Override
            public Set<String> supportedBlueIds() {
                return Collections.unmodifiableSet(new LinkedHashSet<String>(Collections.singletonList("Step/Only")));
            }

            @Override
            public Object execute(StepExecutionArgs args) {
                return "ok";
            }
        };

        NodeProvider provider = blueId -> {
            if (!"Step/Derived".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node().properties("blueId", new Node().value("Step/Only"));
            return Collections.singletonList(definition);
        };

        Blue blue = new Blue(provider);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");

        WorkflowStepRunner runner = new WorkflowStepRunner(Collections.singletonList(executor));
        Node event = new Node().type(new Node().blueId("TestEvent"));
        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);
        Node derived = new Node().type(new Node().blueId("Step/Derived"));

        Map<String, Object> results = runner.run(
                new SequentialWorkflow(),
                Collections.singletonList(derived),
                event,
                context);

        assertEquals(1, results.size());
        assertEquals("ok", results.get("Step1"));
    }
}
