import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import {
  sequentialWorkflowSchema,
  type SequentialWorkflow,
} from '../../model/index.js';
import type { HandlerProcessor, ContractProcessorContext } from '../types.js';
import {
  WorkflowStepRunner,
  DEFAULT_STEP_EXECUTORS,
  type SequentialWorkflowStepExecutor,
} from './workflow/step-runner.js';

export class SequentialWorkflowHandlerProcessor implements HandlerProcessor<SequentialWorkflow> {
  readonly kind = 'handler' as const;
  readonly blueIds = [
    conversationBlueIds['Conversation/Sequential Workflow'],
  ] as const;
  readonly schema = sequentialWorkflowSchema;

  private readonly runner: WorkflowStepRunner;

  constructor(
    executors: readonly SequentialWorkflowStepExecutor[] = DEFAULT_STEP_EXECUTORS,
  ) {
    this.runner = new WorkflowStepRunner(executors);
  }

  async matches(
    contract: SequentialWorkflow,
    context: ContractProcessorContext,
  ): Promise<boolean> {
    const eventNode = context.event();
    if (!eventNode) {
      return false;
    }
    if (
      contract.event &&
      !context.blue.isTypeOfNode(eventNode, contract.event)
    ) {
      return false;
    }
    return true;
  }

  async execute(
    contract: SequentialWorkflow,
    context: ContractProcessorContext,
  ): Promise<void> {
    const eventNode = context.event();
    if (!eventNode) {
      return;
    }

    await this.runner.run({ workflow: contract, eventNode, context });
  }
}
