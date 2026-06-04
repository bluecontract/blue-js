import { BlueNode } from '@blue-labs/language';
import type { BexEngine } from '@blue-labs/bex';
import {
  TriggerEventSchema,
  type TriggerEvent,
} from '@blue-repository/types/packages/coordination/schemas/TriggerEvent';
import { isNullable } from '@blue-labs/shared-utils';

import { conversationBlueIds } from '../../../repository/semantic-repository.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../workflow/step-runner.js';
import { BexFieldEvaluator } from './bex-field-evaluator.js';

export class TriggerEventStepExecutor implements SequentialWorkflowStepExecutor {
  readonly supportedBlueIds = [
    conversationBlueIds['Conversation/Trigger Event'],
  ] as const;

  private readonly bexEvaluator: BexFieldEvaluator;

  constructor(bexEngine?: BexEngine) {
    this.bexEvaluator = new BexFieldEvaluator(bexEngine);
  }

  async execute(args: StepExecutionArgs): Promise<unknown> {
    const { stepNode, context } = args;
    if (
      !context.blue.isTypeOfBlueId(
        stepNode,
        conversationBlueIds['Conversation/Trigger Event'],
      )
    ) {
      return context.throwFatal('Trigger Event step payload is invalid');
    }

    context.gasMeter().chargeTriggerEventBase();
    let resolvedStepNode = stepNode;
    const eventNode = resolvedStepNode.getProperties()?.event;
    if (
      eventNode !== undefined &&
      this.bexEvaluator.containsExpression(eventNode)
    ) {
      resolvedStepNode = resolvedStepNode.clone();
      resolvedStepNode.addProperty(
        'event',
        this.bexEvaluator.evaluateNode(args, eventNode),
      );
    }

    const triggerEvent = context.blue.nodeToSchemaOutput<TriggerEvent>(
      resolvedStepNode,
      TriggerEventSchema,
    );
    const emission = triggerEvent.event;

    if (isNullable(emission)) {
      return context.throwFatal(
        'Trigger Event step must declare event payload',
      );
    }

    if (!this.isObjectPayload(emission)) {
      return context.throwFatal(
        'Trigger Event payload must evaluate to an object',
      );
    }

    context.emitEvent(emission.clone());
    return undefined;
  }

  private isObjectPayload(node: BlueNode): boolean {
    if (node.getValue() !== undefined || node.getItems() !== undefined) {
      return false;
    }
    return node.getProperties() !== undefined || node.getType() !== undefined;
  }
}
