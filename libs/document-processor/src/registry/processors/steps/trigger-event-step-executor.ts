import { BlueNode } from '@blue-labs/language';
import {
  blueIds as conversationBlueIds,
  TriggerEventSchema,
} from '@blue-repository/conversation';
import { isNullable } from '@blue-labs/shared-utils';

import { QuickJSEvaluator } from '../../../util/expression/quickjs-evaluator.js';
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

export class TriggerEventStepExecutor
  implements SequentialWorkflowStepExecutor
{
  readonly supportedBlueIds = [conversationBlueIds['Trigger Event']] as const;

  private readonly evaluator = new QuickJSEvaluator();

  async execute(args: StepExecutionArgs): Promise<unknown> {
    const { stepNode, context } = args;
    if (!context.blue.isTypeOf(stepNode, TriggerEventSchema)) {
      return context.throwFatal('Trigger Event step payload is invalid');
    }

    context.gasMeter().chargeTriggerEventBase();
    const resolvedStepNode = await resolveNodeExpressions({
      evaluator: this.evaluator,
      node: stepNode,
      bindings: createQuickJSStepBindings(args),
      shouldResolve: createPicomatchShouldResolve({
        include: ['/event', '/event/**'],
      }),
      shouldDescend: createTriggerEventShouldDescend(),
      context,
    });

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

    context.emitEvent(emission.clone());
    return undefined;
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
