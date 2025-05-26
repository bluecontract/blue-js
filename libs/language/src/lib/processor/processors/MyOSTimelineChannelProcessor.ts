import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { z } from 'zod';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import { blueIds } from '../../../repo/myos/blue-ids';
import { MyOSTimelineChannelSchema } from '../../../repo/myos/schema';

const timelineEntrySchema = z.object({
  type: z.literal('Timeline Entry'),
  timeline: z
    .object({
      timelineId: z.string().optional(),
      account: z.string().optional(),
      email: z.string().optional(),
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

    const myosTimelineChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, MyOSTimelineChannelSchema);

    const payloadTimeline = event.payload.timeline;
    if (!payloadTimeline) return false;

    const hasTimelineId = isNonNullable(myosTimelineChannel.timelineId);
    const hasAccount = isNonNullable(myosTimelineChannel.account);
    const hasEmail = isNonNullable(myosTimelineChannel.email);

    return (
      (hasTimelineId &&
        payloadTimeline.timelineId === myosTimelineChannel.timelineId) ||
      (hasAccount && payloadTimeline.account === myosTimelineChannel.account) ||
      (hasEmail && payloadTimeline.email === myosTimelineChannel.email)
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
