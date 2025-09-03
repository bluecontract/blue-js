import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import {
  blueIds,
  MyOSTimelineChannelSchema,
  MyOSTimelineEntrySchema,
} from '@blue-repository/myos-dev';
import { TimelineEntrySchema } from '@blue-repository/core-dev';

const isTimelineEntryEvent = (evt: EventNode, ctx: ProcessingContext) => {
  const blue = ctx.getBlue();
  return (
    blue.isTypeOf(evt.payload, TimelineEntrySchema) ||
    blue.isTypeOf(evt.payload, MyOSTimelineEntrySchema)
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
    if (!isTimelineEntryEvent(event, ctx)) return false;
    const blue = ctx.getBlue();

    const myosTimelineEntry = blue.nodeToSchemaOutput(
      event.payload,
      MyOSTimelineEntrySchema
    );
    const myosTimelineChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, MyOSTimelineChannelSchema);

    const timelineEntryTimelineId = myosTimelineEntry.timeline?.timelineId;

    const hasTimelineId =
      isNonNullable(myosTimelineChannel.timelineId) &&
      isNonNullable(timelineEntryTimelineId);

    return (
      (hasTimelineId &&
        timelineEntryTimelineId === myosTimelineChannel.timelineId)
    );
  }

  handle(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
    path: string
  ): void {
    if (!isTimelineEntryEvent(event, ctx)) return;

    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: 'channel',
    });
  }
}
