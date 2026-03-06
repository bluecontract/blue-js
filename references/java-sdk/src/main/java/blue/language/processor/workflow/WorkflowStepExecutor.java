package blue.language.processor.workflow;

import java.util.Set;

public interface WorkflowStepExecutor {

    Object NO_RESULT = new Object();

    Set<String> supportedBlueIds();

    Object execute(StepExecutionArgs args);
}
