package blue.language.processor.model;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@TypeBlueId({
        "Conversation/Sequential Workflow Operation",
        "SequentialWorkflowOperation",
        "Conversation/Change Workflow",
        "ChangeWorkflow"
})
public class SequentialWorkflowOperation extends HandlerContract {

    private String operation;
    private final List<Node> steps = new ArrayList<>();

    public String getOperation() {
        return operation;
    }

    public SequentialWorkflowOperation setOperation(String operation) {
        this.operation = operation;
        return this;
    }

    public SequentialWorkflowOperation operation(String operation) {
        return setOperation(operation);
    }

    public List<Node> getSteps() {
        return Collections.unmodifiableList(steps);
    }

    public SequentialWorkflowOperation setSteps(List<Node> steps) {
        this.steps.clear();
        if (steps == null) {
            return this;
        }
        for (Node step : steps) {
            this.steps.add(step != null ? step.clone() : null);
        }
        return this;
    }

    public SequentialWorkflowOperation steps(List<Node> steps) {
        return setSteps(steps);
    }
}
