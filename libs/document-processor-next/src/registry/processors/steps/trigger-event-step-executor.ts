import {
  blueIds as conversationBlueIds,
  TriggerEventSchema,
} from '@blue-repository/conversation';
import { isNullable } from '@blue-labs/shared-utils';

import { QuickJSEvaluator } from '../../../util/expression/quickjs-evaluator.js';
import {
  resolveNodeExpressions,
  createPicomatchShouldResolve,
} from '../../../util/expression/quickjs-expression-utils.js';
import { createQuickJSStepBindings } from './quickjs-step-bindings.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../sequential-workflow-processor.js';

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

    const resolvedStepNode = await resolveNodeExpressions({
      evaluator: this.evaluator,
      node: stepNode,
      bindings: createQuickJSStepBindings(args),
      shouldResolve: createPicomatchShouldResolve({
        include: ['/event', '/event/**'],
      }),
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
