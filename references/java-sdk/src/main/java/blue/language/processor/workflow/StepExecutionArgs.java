package blue.language.processor.workflow;

import blue.language.model.Node;
import blue.language.processor.ProcessorExecutionContext;
import blue.language.processor.model.HandlerContract;

import java.util.Map;

public final class StepExecutionArgs {
    private final HandlerContract workflow;
    private final Node stepNode;
    private final Node eventNode;
    private final ProcessorExecutionContext context;
    private final Map<String, Object> stepResults;
    private final int stepIndex;
    private final Node contractNode;

    public StepExecutionArgs(HandlerContract workflow,
                             Node stepNode,
                             Node eventNode,
                             ProcessorExecutionContext context,
                             Map<String, Object> stepResults,
                             int stepIndex) {
        this(workflow, stepNode, eventNode, context, stepResults, stepIndex, null);
    }

    public StepExecutionArgs(HandlerContract workflow,
                             Node stepNode,
                             Node eventNode,
                             ProcessorExecutionContext context,
                             Map<String, Object> stepResults,
                             int stepIndex,
                             Node contractNode) {
        this.workflow = workflow;
        this.stepNode = stepNode;
        this.eventNode = eventNode;
        this.context = context;
        this.stepResults = stepResults;
        this.stepIndex = stepIndex;
        this.contractNode = contractNode;
    }

    public HandlerContract workflow() {
        return workflow;
    }

    public Node stepNode() {
        return stepNode;
    }

    public Node eventNode() {
        return eventNode;
    }

    public ProcessorExecutionContext context() {
        return context;
    }

    public Map<String, Object> stepResults() {
        return stepResults;
    }

    public int stepIndex() {
        return stepIndex;
    }

    public Node contractNode() {
        return contractNode;
    }
}
