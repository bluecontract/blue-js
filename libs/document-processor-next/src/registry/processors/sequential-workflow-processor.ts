import { BlueNode } from '@blue-labs/language';
import {
  TriggerEventSchema,
  blueIds as conversationBlueIds,
} from '@blue-repository/conversation';

import {
  sequentialWorkflowSchema,
  type SequentialWorkflow,
} from '../../model/index.js';
import type { HandlerProcessor, ContractProcessorContext } from '../types.js';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';

type StepResultMap = Record<string, unknown>;

interface StepExecutionArgs {
  readonly workflow: SequentialWorkflow;
  readonly stepNode: BlueNode;
  readonly eventNode: BlueNode;
  readonly context: ContractProcessorContext;
  readonly stepResults: StepResultMap;
  readonly stepIndex: number;
}

interface SequentialWorkflowStepExecutor {
  readonly supportedBlueIds: readonly string[];
  execute(args: StepExecutionArgs): unknown;
}

class TriggerEventStepExecutor implements SequentialWorkflowStepExecutor {
  readonly supportedBlueIds = [conversationBlueIds['Trigger Event']] as const;

  execute(args: StepExecutionArgs): unknown {
    const { stepNode, context } = args;
    if (!context.blue.isTypeOf(stepNode, TriggerEventSchema)) {
      context.throwFatal('Trigger Event step payload is invalid');
    }

    const triggerEvent = context.blue.nodeToSchemaOutput(
      stepNode,
      TriggerEventSchema
    );
    const emission = triggerEvent.event;

    if (isNonNullable(emission)) {
      context.emitEvent(emission.clone());
    } else {
      context.throwFatal('Trigger Event step must declare event payload');
    }

    return undefined;
  }
}

const DEFAULT_STEP_EXECUTORS: readonly SequentialWorkflowStepExecutor[] = [
  new TriggerEventStepExecutor(),
];

export class SequentialWorkflowHandlerProcessor
  implements HandlerProcessor<SequentialWorkflow>
{
  readonly kind = 'handler' as const;
  readonly blueIds = [conversationBlueIds['Sequential Workflow']] as const;
  readonly schema = sequentialWorkflowSchema;

  private readonly executorIndex: ReadonlyMap<
    string,
    SequentialWorkflowStepExecutor
  >;

  constructor(
    executors: readonly SequentialWorkflowStepExecutor[] = DEFAULT_STEP_EXECUTORS
  ) {
    const byId = new Map<string, SequentialWorkflowStepExecutor>();
    for (const executor of executors) {
      for (const blueId of executor.supportedBlueIds) {
        byId.set(blueId, executor);
      }
    }
    this.executorIndex = byId;
  }

  execute(
    contract: SequentialWorkflow,
    context: ContractProcessorContext
  ): void {
    const eventNode = context.event();
    if (!eventNode) {
      return;
    }

    if (
      contract.event &&
      !this.matchesEventPattern(contract.event, eventNode, context)
    ) {
      return;
    }

    const steps = contract.steps ?? [];
    if (steps.length === 0) {
      return;
    }

    const results: StepResultMap = {};
    steps.forEach((stepNode, index) => {
      this.executeStep({
        workflow: contract,
        stepNode,
        eventNode,
        context,
        stepResults: results,
        stepIndex: index,
      });
    });
  }

  private matchesEventPattern(
    matcher: BlueNode,
    eventNode: BlueNode,
    context: ContractProcessorContext
  ): boolean {
    try {
      return context.blue.isTypeOfNode(eventNode, matcher);
    } catch (error) {
      console.warn(
        'SequentialWorkflowHandlerProcessor event match failed',
        error
      );
      return false;
    }
  }

  private executeStep(args: StepExecutionArgs): void {
    const { stepNode, context, stepResults, stepIndex } = args;
    const blueId = stepNode.getType?.()?.getBlueId();
    if (isNullable(blueId)) {
      return context.throwFatal(
        'Sequential workflow step is missing type metadata'
      );
    }

    const executor = this.executorIndex.get(blueId);
    if (isNullable(executor)) {
      const typeName = stepNode.getType?.()?.getName?.() ?? blueId;
      return context.throwFatal(`Unsupported workflow step type "${typeName}"`);
    }

    const result = executor.execute(args);
    if (result !== undefined) {
      const key = this.stepResultKey(stepNode, stepIndex);
      stepResults[key] = result;
    }
  }

  private stepResultKey(stepNode: BlueNode, index: number): string {
    const name = stepNode.getName?.();
    if (name && typeof name === 'string' && name.length > 0) {
      return name;
    }
    return `Step${index + 1}`;
  }
}
