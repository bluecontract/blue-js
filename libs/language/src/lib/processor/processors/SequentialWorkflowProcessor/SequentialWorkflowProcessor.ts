import {
  ContractProcessor,
  EventNode,
  DocumentNode,
  ProcessingContext,
} from '../../types';
import { WorkflowStepExecutor } from './types';
import { UpdateDocumentExecutor } from './steps/UpdateDocumentExecutor';
import { TriggerEventExecutor } from './steps/TriggerEventExecutor';
import { JavaScriptCodeExecutor } from './steps/JavaScriptCodeExecutor';
import { blueIds, SequentialWorkflowSchema } from '@blue-repository/core-dev';

const defaultExecutors: WorkflowStepExecutor[] = [
  new UpdateDocumentExecutor(),
  new TriggerEventExecutor(),
  new JavaScriptCodeExecutor(),
];

export class SequentialWorkflowProcessor implements ContractProcessor {
  readonly contractType = 'Sequential Workflow';
  readonly contractBlueId = blueIds['Sequential Workflow'];
  readonly role = 'handler';

  private executors: WorkflowStepExecutor[] = [];

  constructor(executors: WorkflowStepExecutor[] = defaultExecutors) {
    this.executors = executors;
  }

  /** allow registering custom step executors */
  registerExecutor(ex: WorkflowStepExecutor) {
    this.executors.push(ex);
  }

  supports(
    event: EventNode,
    node: DocumentNode,
    context: ProcessingContext
  ): boolean {
    const blue = context.getBlue();
    const sequentialWorkflow = blue.nodeToSchemaOutput(
      node,
      SequentialWorkflowSchema
    );
    const channel = sequentialWorkflow.channel;

    return event.source === 'channel' && event.channelName === channel;
  }

  async handle(
    event: EventNode,
    node: DocumentNode,
    context: ProcessingContext,
    path: string
  ): Promise<void> {
    // const blue = context.getBlue();
    // const sequentialWorkflow = blue.nodeToSchemaOutput(
    //   node,
    //   SequentialWorkflowSchema
    // );
    const stepResults: Record<string, unknown> = {};
    const stepNodes = node.getProperties()?.['steps'].getItems();

    for (const [i, step] of (stepNodes ?? []).entries()) {
      const stepExecutor = this.executors.find((e) => e.supports(step));
      if (!stepExecutor) {
        throw new Error(`Unsupported workflow step type "${step.getType()}"`);
      }

      const result = await stepExecutor.execute(
        step,
        event,
        context,
        path,
        stepResults
      );

      if (result !== undefined) {
        const stepName = step.getName();
        const key = typeof stepName === 'string' ? stepName : `Step${i + 1}`;
        stepResults[key] = result;
      }

      await context.flush();
    }
  }

  init(): EventNode[] {
    return [];
  }
}
