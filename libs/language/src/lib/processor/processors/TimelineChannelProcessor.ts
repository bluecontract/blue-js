import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import { blueIds } from '../../../repo/core/blue-ids';
import {
  TimelineChannelSchema,
  TimelineEntry,
  TimelineEntrySchema,
} from '../../../repo/core';

const isTimelineEntryEvent = (
  evt: EventNode
): evt is EventNode<TimelineEntry> => evt.payload.type === 'Timeline Entry';

/* ------------------------------------------------------------------------ */
/* Timeline Channel – unwraps timeline entries                              */
/* ------------------------------------------------------------------------ */
export class TimelineChannelProcessor extends BaseChannelProcessor {
  readonly contractType = 'Timeline Channel';
  readonly contractBlueId = blueIds['Timeline Channel'];

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    if (!this.baseSupports(event)) return false;
    if (!isTimelineEntryEvent(event)) return false;

    const blue = ctx.getBlue();
    const eventPayloadNode = blue.jsonValueToNode(event.payload);
    const timelineEntry = blue.nodeToSchemaOutput(
      eventPayloadNode,
      TimelineEntrySchema
    );
    const timelineChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, TimelineChannelSchema);

    const hasTimelineId =
      isNonNullable(timelineChannel.timelineId) &&
      isNonNullable(timelineEntry.timelineId);

    return (
      hasTimelineId && timelineEntry.timelineId === timelineChannel.timelineId
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
