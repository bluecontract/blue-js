package blue.language.processor.registry.processors;

import blue.language.model.Node;
import blue.language.processor.HandlerProcessor;
import blue.language.processor.ProcessorExecutionContext;
import blue.language.processor.model.SequentialWorkflow;
import blue.language.processor.util.ProcessorPointerConstants;
import blue.language.processor.workflow.WorkflowStepRunner;

import java.util.List;

public class SequentialWorkflowHandlerProcessor implements HandlerProcessor<SequentialWorkflow> {

    private final WorkflowStepRunner stepRunner;

    public SequentialWorkflowHandlerProcessor() {
        this(WorkflowStepRunner.defaultRunner());
    }

    public SequentialWorkflowHandlerProcessor(WorkflowStepRunner stepRunner) {
        this.stepRunner = stepRunner;
    }

    @Override
    public Class<SequentialWorkflow> contractType() {
        return SequentialWorkflow.class;
    }

    @Override
    public boolean matches(SequentialWorkflow contract, ProcessorExecutionContext context) {
        return WorkflowContractSupport.matchesEventFilter(context.event(), contract.getEvent(), context.nodeProvider());
    }

    @Override
    public void execute(SequentialWorkflow contract, ProcessorExecutionContext context) {
        List<Node> steps = contract.getSteps();
        if (steps == null || steps.isEmpty()) {
            return;
        }
        stepRunner.run(contract, steps, context.event(), context, resolveContractNode(contract, context));
    }

    private Node resolveContractNode(SequentialWorkflow contract, ProcessorExecutionContext context) {
        if (contract == null || contract.getKey() == null || contract.getKey().trim().isEmpty()) {
            return null;
        }
        String contractPointer = context.resolvePointer(
                ProcessorPointerConstants.relativeContractsEntry(contract.getKey().trim()));
        return context.documentAt(contractPointer);
    }
}
