import {
  ContractProcessor,
  DocumentNode,
  EventNode,
  ProcessingContext,
} from '../types';
import {
  blueIds,
  OperationRequestSchema,
  OperationSchema,
  TimelineEntrySchema,
} from '@blue-repository/core-dev';
import { isNonNullable } from '../utils/typeGuard';

export class OperationProcessor implements ContractProcessor {
  readonly contractType = 'Operation';
  readonly contractBlueId = blueIds['Operation'];
  readonly role = 'adapter';

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
    contractName: string
  ): boolean {
    const blue = ctx.getBlue();

    const operationDefinition = blue.nodeToSchemaOutput(node, OperationSchema);
    const eventOperationRequest = this.parseEventPayload(event, ctx);

    //TODO: Check event for operationDefinition.request pattern

    return (
      isNonNullable(eventOperationRequest?.operation) &&
      eventOperationRequest.operation === contractName &&
      event.source === 'channel' &&
      event.channelName === operationDefinition.channel
    );
  }

  async handle(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
    contractName?: string
  ): Promise<void> {
    ctx.emitEvent({
      payload: event.payload,
      channelName: contractName,
      source: 'channel',
    });
  }

  private parseEventPayload(event: EventNode, ctx: ProcessingContext) {
    const blue = ctx.getBlue();
    const eventPayloadNode = blue.jsonValueToNode(event.payload);

    if (
      blue.isTypeOf(eventPayloadNode, TimelineEntrySchema, {
        checkSchemaExtensions: true,
      })
    ) {
      const timelineEntry = blue.nodeToSchemaOutput(
        eventPayloadNode,
        TimelineEntrySchema
      );
      if (timelineEntry.message) {
        const operationRequest = blue.nodeToSchemaOutput(
          timelineEntry.message,
          OperationRequestSchema
        );
        return operationRequest;
      }
    }

    return null;
  }
}
