import { BlueNodeTypeSchema } from '../../../../utils/TypeSchema';
import { EventNode, ProcessingContext } from '../../../types';
import { DocumentNode } from '../../../types';
import { WorkflowStepExecutor } from '../types';
import { TriggerEventSchema } from '../../../../../repo/core';
import { NodeToMapListOrValue } from '../../../../utils/NodeToMapListOrValue';

export class TriggerEventExecutor implements WorkflowStepExecutor {
  readonly stepType = 'Trigger Event';

  supports(node: DocumentNode) {
    return BlueNodeTypeSchema.isTypeOf(node, TriggerEventSchema);
  }

  async execute(
    step: DocumentNode,
    event: EventNode,
    ctx: ProcessingContext
  ): Promise<void> {
    if (!BlueNodeTypeSchema.isTypeOf(step, TriggerEventSchema)) return;

    const triggerEventStep = ctx
      .getBlue()
      .nodeToSchemaOutput(step, TriggerEventSchema);

    // TODO: change it
    const payload = NodeToMapListOrValue.get(
      triggerEventStep.event,
      'simple'
    ) as any;

    ctx.emitEvent({
      payload,
    });

    return;
  }
}
