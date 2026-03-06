package blue.language.types.conversation;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

import java.util.List;

@TypeAlias("Conversation/Sequential Workflow")
@TypeBlueId("7X3LkN54Yp88JgZbppPhP6hM3Jqiqv8Z2i4kS7phXtQe")
public class SequentialWorkflow {
    public List<Node> steps;

    public SequentialWorkflow steps(List<Node> steps) {
        this.steps = steps;
        return this;
    }
}
