import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { z } from 'zod';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import { blueIds } from '../../../repo/core/blue-ids';
import { TimelineChannelSchema } from '../../../repo/core/schema';

const timelineEntrySchema = z.object({
  type: z.literal('Timeline Entry'),
  timeline: z
    .object({
      timelineId: z.string().optional(),
      account: z.string().optional(),
      email: z.string().optional(),
      userId: z.string().optional(),
    })
    .optional(),
  message: z
    .object({
      type: z.string().optional(),
    })
    .optional(),
});

type TimelineEntry = z.infer<typeof timelineEntrySchema>;

const isTimelineEntryEvent = (
  evt: EventNode
): evt is EventNode<TimelineEntry> =>
  timelineEntrySchema.safeParse(evt.payload).success;

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

    const timelineChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, TimelineChannelSchema);

    const payloadTimeline = event.payload.timeline;
    if (!payloadTimeline) return false;

    const hasTimelineId = isNonNullable(timelineChannel.timelineId);

    return (
      hasTimelineId && payloadTimeline.timelineId === timelineChannel.timelineId
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
