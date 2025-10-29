import {
  EventNode,
  DocumentNode,
  ProcessingContext,
  ContractProcessor,
} from '../types';
import {
  blueIds,
  CompositeTimelineChannelSchema,
} from '@blue-repository/core-dev';

export class CompositeTimelineChannelProcessor implements ContractProcessor {
  readonly contractType = 'Composite Timeline Channel';
  readonly contractBlueId = blueIds['Composite Timeline Channel'];
  readonly role = 'adapter';

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
  ): boolean {
    const compositeTimelineChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, CompositeTimelineChannelSchema);

    if (!compositeTimelineChannel.channels) return false;
    if (!event.channelName) return false;

    return compositeTimelineChannel.channels.includes(event.channelName);
  }

  handle(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
    path: string,
  ): void {
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: 'channel',
    });
  }
}
