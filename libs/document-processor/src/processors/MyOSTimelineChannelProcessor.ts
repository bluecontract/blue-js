import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import {
  blueIds,
  MyOSTimelineChannelSchema,
  MyOSTimelineEntry,
  MyOSTimelineEntrySchema,
} from '@blue-repository/myos-dev';

// TODO: Event payload probably should be also mapped to BlueNode
const isTimelineEntryEvent = (
  evt: EventNode
): evt is EventNode<MyOSTimelineEntry> => {
  return (
    evt.payload.type === 'Timeline Entry' ||
    evt.payload.type === 'MyOS Timeline Entry'
  );
};

/* ------------------------------------------------------------------------ */
/* Timeline Channel – unwraps timeline entries                              */
/* ------------------------------------------------------------------------ */
export class MyOSTimelineChannelProcessor extends BaseChannelProcessor {
  readonly contractType = 'MyOS Timeline Channel';
  readonly contractBlueId = blueIds['MyOS Timeline Channel'];

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    if (!this.baseSupports(event)) return false;
    if (!isTimelineEntryEvent(event)) return false;
    const blue = ctx.getBlue();

    const eventPayloadNode = blue.jsonValueToNode(event.payload);
    const myosTimelineEntry = blue.nodeToSchemaOutput(
      eventPayloadNode,
      MyOSTimelineEntrySchema
    );
    const myosTimelineChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, MyOSTimelineChannelSchema);

    const timelineEntryTimelineId = myosTimelineEntry.timeline?.timelineId;

    const hasTimelineId =
      isNonNullable(myosTimelineChannel.timelineId) &&
      isNonNullable(timelineEntryTimelineId);
    const hasAccount =
      isNonNullable(myosTimelineChannel.account) &&
      isNonNullable(myosTimelineEntry.account);
    const hasEmail =
      isNonNullable(myosTimelineChannel.email) &&
      isNonNullable(myosTimelineEntry.email);

    return (
      (hasTimelineId &&
        timelineEntryTimelineId === myosTimelineChannel.timelineId) ||
      (hasAccount &&
        myosTimelineEntry.account === myosTimelineChannel.account) ||
      (hasEmail && myosTimelineEntry.email === myosTimelineChannel.email)
    );
  }

  handle(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
    path: string
  ): void {
    if (!isTimelineEntryEvent(event)) return;

    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: 'channel',
    });
  }
}
