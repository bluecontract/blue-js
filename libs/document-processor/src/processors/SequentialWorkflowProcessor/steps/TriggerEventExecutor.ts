import { BlueNodeTypeSchema } from '@blue-labs/language';
import { EventNode, EventNodePayload, ProcessingContext } from '../../../types';
import { DocumentNode } from '../../../types';
import { WorkflowStepExecutor } from '../types';
import { TriggerEventSchema } from '../../../repo/core';

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
    const blue = ctx.getBlue();
    if (!BlueNodeTypeSchema.isTypeOf(step, TriggerEventSchema)) return;

    const triggerEventStep = blue.nodeToSchemaOutput(step, TriggerEventSchema);

    // TODO: change it
    const payload = blue.nodeToJson(
      triggerEventStep.event,
      'original'
    ) as EventNodePayload;

    ctx.emitEvent({
      payload,
    });

    return;
  }
}
