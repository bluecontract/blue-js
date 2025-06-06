import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { SequentialWorkflowProcessor } from './SequentialWorkflowProcessor';
import { blueIds } from '../../../repo/core/blue-ids';
import { SequentialWorkflowOperationSchema } from '../../../repo/core/schema';
import { isNonNullable } from '@blue-labs/shared-utils';

export class SequentialWorkflowOperationProcessor {
  readonly contractType = 'Sequential Workflow Operation';
  readonly contractBlueId = blueIds['Sequential Workflow Operation'];
  readonly role = 'handler';

  private sequentialWorkflowProcessor: SequentialWorkflowProcessor;

  constructor(sequentialWorkflowProcessor?: SequentialWorkflowProcessor) {
    this.sequentialWorkflowProcessor =
      sequentialWorkflowProcessor || new SequentialWorkflowProcessor();
  }

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    const blue = ctx.getBlue();
    const sequentialWorkflowOperation = blue.nodeToSchemaOutput(
      node,
      SequentialWorkflowOperationSchema
    );
    const operation = sequentialWorkflowOperation.operation;
    const eventChannelName = event.channelName;

    return (
      event.source === 'channel' &&
      isNonNullable(eventChannelName) &&
      isNonNullable(operation) &&
      eventChannelName === operation
    );
  }

  async handle(
    event: EventNode,
    node: DocumentNode,
    context: ProcessingContext,
    path: string
  ): Promise<void> {
    try {
      await this.sequentialWorkflowProcessor.handle(event, node, context, path);
    } catch (error) {
      console.error(
        'Error in SequentialWorkflowOperationProcessor.handle:',
        error
      );
      throw error;
    }
  }
}
