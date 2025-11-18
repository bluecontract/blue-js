import { BlueNode } from '@blue-labs/language';
import {
  TimelineEntrySchema,
  type TimelineEntry,
} from '@blue-repository/conversation';
import {
  MyOSTimelineEntrySchema,
  type MyOSTimelineEntry,
  blueIds as myosBlueIds,
} from '@blue-repository/myos';

import {
  myosTimelineChannelSchema,
  type MyOSTimelineChannel,
} from '../../model/index.js';
import type { ChannelEvaluationContext, ChannelProcessor } from '../types.js';

function resolveTimelineEntry(
  blue: ChannelEvaluationContext['blue'],
  event: BlueNode,
): MyOSTimelineEntry | TimelineEntry | null {
  if (blue.isTypeOf(event, MyOSTimelineEntrySchema)) {
    return blue.nodeToSchemaOutput(event, MyOSTimelineEntrySchema);
  }
  if (blue.isTypeOf(event, TimelineEntrySchema)) {
    return blue.nodeToSchemaOutput(event, TimelineEntrySchema);
  }
  return null;
}

export class MyOSTimelineChannelProcessor
  implements ChannelProcessor<MyOSTimelineChannel>
{
  readonly kind = 'channel' as const;
  readonly blueIds = [myosBlueIds['MyOS Timeline Channel']] as const;
  readonly schema = myosTimelineChannelSchema;

  matches(
    contract: MyOSTimelineChannel,
    context: ChannelEvaluationContext,
  ): boolean {
    const { event, blue } = context;
    if (!event) {
      return false;
    }

    const entry = resolveTimelineEntry(blue, event);
    if (!entry) {
      return false;
    }

    const entryTimelineId = entry.timeline?.timelineId;
    if (!entryTimelineId || !contract.timelineId) {
      return false;
    }

    return entryTimelineId === contract.timelineId;
  }

  channelize(
    contract: MyOSTimelineChannel,
    context: ChannelEvaluationContext,
  ): BlueNode | null | undefined {
    const { event, blue } = context;
    if (!event) {
      return null;
    }

    const entry = resolveTimelineEntry(blue, event);
    if (!entry) {
      return null;
    }

    return event.clone();
  }
}
