import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import { blueIds } from '../../../repo/core/blue-ids';
import { CompositeTimelineChannelSchema } from '../../../repo/core/schema';

export class CompositeTimelineChannelProcessor extends BaseChannelProcessor {
  readonly contractType = 'Composite Timeline Channel';
  readonly contractBlueId = blueIds['Composite Timeline Channel'];

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
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
    path: string
  ): void {
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: 'channel',
    });
  }
}
