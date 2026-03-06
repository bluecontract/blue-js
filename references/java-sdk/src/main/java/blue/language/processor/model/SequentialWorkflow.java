package blue.language.processor.model;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@TypeBlueId({"Conversation/Sequential Workflow", "SequentialWorkflow"})
public class SequentialWorkflow extends HandlerContract {

    private final List<Node> steps = new ArrayList<>();

    public List<Node> getSteps() {
        return Collections.unmodifiableList(steps);
    }

    public SequentialWorkflow setSteps(List<Node> steps) {
        this.steps.clear();
        if (steps == null) {
            return this;
        }
        for (Node step : steps) {
            this.steps.add(step != null ? step.clone() : null);
        }
        return this;
    }

    public SequentialWorkflow steps(List<Node> steps) {
        return setSteps(steps);
    }
}
