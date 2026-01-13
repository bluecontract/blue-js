import type { ChannelEvaluationContext, ChannelProcessor } from '../types.js';
import { BlueNode } from '@blue-labs/language';
import { TimelineEntrySchema } from '@blue-repository/types/packages/conversation/schemas/TimelineEntry';
import { blueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import {
  timelineChannelSchema,
  type TimelineChannel,
} from '../../model/index.js';
import { isTimelineEventNewer } from './shared/timeline-recency.js';

export class TimelineChannelProcessor implements ChannelProcessor<TimelineChannel> {
  readonly kind = 'channel' as const;
  readonly blueIds = [blueIds['Conversation/Timeline Channel']] as const;
  readonly schema = timelineChannelSchema;

  matches(
    contract: TimelineChannel,
    context: ChannelEvaluationContext,
  ): boolean {
    const { event, blue } = context;
    if (!event || !blue.isTypeOf(event, TimelineEntrySchema)) {
      return false;
    }

    const entry = blue.nodeToSchemaOutput(event, TimelineEntrySchema);
    const entryTimelineId = entry.timeline?.timelineId;
    if (!entryTimelineId || !contract.timelineId) {
      return false;
    }
    if (entryTimelineId !== contract.timelineId) {
      return false;
    }

    return true;
  }

  channelize(
    contract: TimelineChannel,
    context: ChannelEvaluationContext,
  ): BlueNode | null | undefined {
    const { event, blue } = context;
    if (!event || !blue.isTypeOf(event, TimelineEntrySchema)) {
      return null;
    }
    return event.clone();
  }

  isNewerEvent(
    contract: TimelineChannel,
    context: ChannelEvaluationContext,
    lastEvent: BlueNode,
  ): boolean {
    const { event, blue } = context;
    if (!event) {
      return true;
    }
    return isTimelineEventNewer(blue, event, lastEvent);
  }
}
