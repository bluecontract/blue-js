import {
  ContractProcessor,
  DocumentNode,
  EventNode,
  ProcessingContext,
} from '../types';
import {
  blueIds,
  Operation,
  OperationRequest,
  OperationRequestSchema,
  OperationSchema,
  TimelineEntrySchema,
} from '@blue-repository/core-dev';
import { isNonNullable } from '../utils/typeGuard';
import { isNullable } from '@blue-labs/shared-utils';

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

    const matchOperationName = this.isOperationNameMatch(
      eventOperationRequest,
      contractName
    );

    const matchChannelName = this.isOperationChannelMatch(
      event,
      operationDefinition
    );

    const matchRequestPattern = this.isRequestPatternMatch(
      eventOperationRequest,
      operationDefinition,
      ctx
    );

    return matchOperationName && matchChannelName && matchRequestPattern;
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

    if (
      blue.isTypeOf(event.payload, TimelineEntrySchema, {
        checkSchemaExtensions: true,
      })
    ) {
      const timelineEntry = blue.nodeToSchemaOutput(
        event.payload,
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

  private isOperationNameMatch(
    eventOperationRequest: OperationRequest | null,
    contractName: string
  ) {
    return (
      isNonNullable(eventOperationRequest?.operation) &&
      eventOperationRequest?.operation === contractName
    );
  }

  private isOperationChannelMatch(
    event: EventNode,
    operationDefinition: Operation
  ) {
    const operationDefinitionChannelName = operationDefinition.channel;
    if (isNullable(operationDefinitionChannelName)) {
      return true;
    }

    return (
      event.source === 'channel' &&
      event.channelName === operationDefinitionChannelName
    );
  }

  private isRequestPatternMatch(
    eventOperationRequest: OperationRequest | null,
    operationDefinition: Operation,
    ctx: ProcessingContext
  ) {
    const requestNode = operationDefinition.request;
    if (isNullable(requestNode)) {
      return true;
    }

    const blue = ctx.getBlue();
    const eventRequestNode = eventOperationRequest?.request;
    if (isNullable(eventRequestNode)) {
      return false;
    }

    return blue.isTypeOfNode(eventRequestNode, requestNode);
  }
}
