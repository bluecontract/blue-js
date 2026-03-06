package blue.language.types.conversation;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Conversation/Sequential Workflow Operation")
@TypeBlueId("CGdxkNjPcsdescqLPz6SNLsMyak6demQQr7RoKNHbCyv")
public class SequentialWorkflowOperation {
    public String operation;

    public SequentialWorkflowOperation operation(String operation) {
        this.operation = operation;
        return this;
    }
}
