import type { ChannelEvaluationContext, ChannelProcessor } from '../types.js';
import { BlueNode } from '@blue-labs/language';
import { TimelineEntrySchema, blueIds } from '@blue-repository/conversation';

import {
  timelineChannelSchema,
  type TimelineChannel,
} from '../../model/index.js';

export class TimelineChannelProcessor
  implements ChannelProcessor<TimelineChannel>
{
  readonly kind = 'channel' as const;
  readonly blueIds = [blueIds['Timeline Channel']] as const;
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
    const entry = blue.nodeToSchemaOutput(event, TimelineEntrySchema);
    const messageNode = entry.message as BlueNode | undefined;
    if (!messageNode) return null;

    return messageNode.clone();
  }
}
