import { BlueNode } from '@blue-labs/language';
import type { BexEngine } from '@blue-labs/bex';
import { TriggerEventSchema } from '@blue-repository/types/packages/coordination/schemas/TriggerEvent';
import { isNullable } from '@blue-labs/shared-utils';

import { QuickJSEvaluator } from '../../../util/expression/quickjs-evaluator.js';
import { conversationBlueIds } from '../../../repository/semantic-repository.js';
import { createQuickJSStepBindings } from './quickjs-step-bindings.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../workflow/step-runner.js';
import {
  resolveNodeExpressions,
  createPicomatchShouldResolve,
  type ExpressionTraversalPredicate,
} from '../../../util/expression/quickjs-expression-utils.js';
import { BexFieldEvaluator } from './bex-field-evaluator.js';

export class TriggerEventStepExecutor implements SequentialWorkflowStepExecutor {
  readonly supportedBlueIds = [
    conversationBlueIds['Conversation/Trigger Event'],
  ] as const;

  private readonly evaluator = new QuickJSEvaluator();
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
    let resolvedStepNode = await resolveNodeExpressions({
      evaluator: this.evaluator,
      node: stepNode,
      bindings: createQuickJSStepBindings(args),
      shouldResolve: createPicomatchShouldResolve({
        include: ['/event', '/event/**'],
      }),
      shouldDescend: createTriggerEventShouldDescend(),
      context,
    });
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

    const triggerEvent = context.blue.nodeToSchemaOutput(
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

function createTriggerEventShouldDescend(): ExpressionTraversalPredicate {
  return (pointer, node) => {
    if (pointer === '/event') {
      return true;
    }
    if (!pointer.startsWith('/event/')) {
      return true;
    }
    return !isEmbeddedDocumentNode(node);
  };
}

function isEmbeddedDocumentNode(node: BlueNode): boolean {
  const properties = node.getProperties?.();
  if (!properties) {
    return false;
  }

  const contractsNode = properties.contracts;
  if (contractsNode) {
    return true;
  }
  return false;
}
