package blue.language.processor.workflow;

import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.processor.ProcessorExecutionContext;
import blue.language.processor.model.HandlerContract;
import blue.language.processor.workflow.steps.JavaScriptCodeStepExecutor;
import blue.language.processor.workflow.steps.TriggerEventStepExecutor;
import blue.language.processor.workflow.steps.UpdateDocumentStepExecutor;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class WorkflowStepRunner {

    private final Map<String, WorkflowStepExecutor> executorsByBlueId = new LinkedHashMap<>();

    public WorkflowStepRunner(List<WorkflowStepExecutor> executors) {
        if (executors != null) {
            for (WorkflowStepExecutor executor : executors) {
                if (executor == null || executor.supportedBlueIds() == null) {
                    continue;
                }
                for (String blueId : executor.supportedBlueIds()) {
                    if (blueId != null && !blueId.trim().isEmpty()) {
                        executorsByBlueId.put(blueId, executor);
                    }
                }
            }
        }
    }

    public static WorkflowStepRunner defaultRunner() {
        List<WorkflowStepExecutor> defaults = new ArrayList<>();
        defaults.add(new TriggerEventStepExecutor());
        defaults.add(new JavaScriptCodeStepExecutor());
        defaults.add(new UpdateDocumentStepExecutor());
        return new WorkflowStepRunner(defaults);
    }

    public Map<String, Object> run(HandlerContract workflow, List<Node> steps, Node eventNode, ProcessorExecutionContext context) {
        return run(workflow, steps, eventNode, context, null);
    }

    public Map<String, Object> run(HandlerContract workflow,
                                   List<Node> steps,
                                   Node eventNode,
                                   ProcessorExecutionContext context,
                                   Node contractNode) {
        if (steps == null || steps.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Object> results = new LinkedHashMap<>();
        for (int i = 0; i < steps.size(); i++) {
            Node stepNode = steps.get(i);
            if (stepNode == null || stepNode.getType() == null) {
                context.throwFatal("Sequential workflow step is missing type metadata");
                return results;
            }
            String stepBlueId = primaryTypeBlueId(stepNode.getType());
            WorkflowStepExecutor executor = resolveExecutor(stepNode, context);
            if (executor == null) {
                context.throwFatal("Unsupported workflow step type \"" + resolveUnsupportedStepTypeName(stepNode, stepBlueId) + "\"");
                return results;
            }
            Object value = executor.execute(new StepExecutionArgs(
                    workflow,
                    stepNode,
                    eventNode,
                    context,
                    results,
                    i,
                    contractNode));
            if (value != WorkflowStepExecutor.NO_RESULT) {
                String key = resolveResultKey(stepNode, i);
                results.put(key, value);
            }
        }
        return results;
    }

    private WorkflowStepExecutor resolveExecutor(Node stepNode, ProcessorExecutionContext context) {
        if (stepNode == null || stepNode.getType() == null) {
            return null;
        }
        NodeProvider nodeProvider = context != null ? context.nodeProvider() : null;
        return resolveExecutor(stepNode.getType(), nodeProvider, new LinkedHashSet<String>());
    }

    private WorkflowStepExecutor resolveExecutor(Node typeNode, NodeProvider nodeProvider, Set<String> visitedBlueIds) {
        if (typeNode == null) {
            return null;
        }
        for (String blueId : extractBlueIds(typeNode)) {
            WorkflowStepExecutor direct = executorsByBlueId.get(blueId);
            if (direct != null) {
                return direct;
            }
            if (!visitedBlueIds.add(blueId)) {
                continue;
            }
            if (nodeProvider != null) {
                Node definition = fetchTypeDefinition(nodeProvider, blueId);
                WorkflowStepExecutor viaProvider = resolveExecutor(
                        definition,
                        nodeProvider,
                        visitedBlueIds);
                if (viaProvider != null) {
                    return viaProvider;
                }
            }
        }
        return resolveExecutor(typeNode.getType(), nodeProvider, visitedBlueIds);
    }

    private List<String> extractBlueIds(Node typeNode) {
        if (typeNode == null) {
            return Collections.emptyList();
        }
        List<String> blueIds = new ArrayList<>();
        addBlueId(blueIds, typeNode.getBlueId());
        if (typeNode.getValue() instanceof String) {
            addBlueId(blueIds, String.valueOf(typeNode.getValue()));
        }
        if (typeNode.getProperties() != null && typeNode.getProperties().get("blueId") != null) {
            Node blueIdNode = typeNode.getProperties().get("blueId");
            if (blueIdNode != null && blueIdNode.getValue() != null) {
                addBlueId(blueIds, String.valueOf(blueIdNode.getValue()));
            }
        }
        return blueIds;
    }

    private void addBlueId(List<String> blueIds, String blueId) {
        if (blueId == null) {
            return;
        }
        String normalized = blueId.trim();
        if (normalized.isEmpty() || blueIds.contains(normalized)) {
            return;
        }
        blueIds.add(normalized);
    }

    private Node fetchTypeDefinition(NodeProvider nodeProvider, String blueId) {
        if (nodeProvider == null || blueId == null || blueId.trim().isEmpty()) {
            return null;
        }
        try {
            return nodeProvider.fetchFirstByBlueId(blueId.trim());
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private String primaryTypeBlueId(Node typeNode) {
        List<String> blueIds = extractBlueIds(typeNode);
        if (blueIds.isEmpty()) {
            return "<unknown>";
        }
        return blueIds.get(0);
    }

    private String resolveUnsupportedStepTypeName(Node stepNode, String fallbackBlueId) {
        if (stepNode != null && stepNode.getType() != null && stepNode.getType().getName() != null) {
            String name = stepNode.getType().getName().trim();
            if (!name.isEmpty()) {
                return name;
            }
        }
        return fallbackBlueId;
    }

    private String resolveResultKey(Node stepNode, int index) {
        if (stepNode != null && stepNode.getName() != null && !stepNode.getName().trim().isEmpty()) {
            return stepNode.getName().trim();
        }
        return "Step" + (index + 1);
    }
}
