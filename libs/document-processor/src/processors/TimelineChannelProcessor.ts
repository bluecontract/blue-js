import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import {
  blueIds,
  TimelineChannelSchema,
  TimelineEntry,
  TimelineEntrySchema,
} from '@blue-repository/core-dev';

// TODO: use mapping to TimelineEntry instead of type check
const isTimelineEntryEvent = (
  evt: EventNode
): evt is EventNode<TimelineEntry> => evt.payload.type === 'Timeline Entry';

// TODO: event check validation

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
    const timelineEntry = blue.nodeToSchemaOutput(
      blue.jsonValueToNode(event.payload),
      TimelineEntrySchema
    );
    const timelineChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, TimelineChannelSchema);

    const timelineEntryTimelineId = timelineEntry.timeline?.timelineId;

    const hasTimelineId =
      isNonNullable(timelineChannel.timelineId) &&
      isNonNullable(timelineEntryTimelineId);

    return (
      hasTimelineId && timelineEntryTimelineId === timelineChannel.timelineId
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
