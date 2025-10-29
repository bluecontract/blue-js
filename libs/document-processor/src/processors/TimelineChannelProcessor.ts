import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import {
  blueIds,
  TimelineChannelSchema,
  TimelineEntrySchema,
} from '@blue-repository/core-dev';
import { BlueNodeTypeSchema } from '@blue-labs/language';

const isTimelineEntryEvent = (evt: EventNode) => {
  return BlueNodeTypeSchema.isTypeOf(evt.payload, TimelineEntrySchema);
};

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
    ctx: ProcessingContext,
  ): boolean {
    if (!this.baseSupports(event)) return false;
    if (!isTimelineEntryEvent(event)) return false;

    const blue = ctx.getBlue();
    const timelineEntry = blue.nodeToSchemaOutput(
      event.payload,
      TimelineEntrySchema,
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
    path: string,
  ): void {
    if (!isTimelineEntryEvent(event)) return;

    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: 'channel',
    });
  }
}
