import { Blue, BlueNode } from '@blue-labs/language';
import {
  TimelineEntrySchema,
  type TimelineEntry,
} from '@blue-repository/conversation';

type TimelineEntryLike = Pick<TimelineEntry, 'timestamp'>;

function toTimelineEntry(
  blue: Blue,
  node: BlueNode | null | undefined,
): TimelineEntryLike | null {
  if (!node) {
    return null;
  }
  if (
    blue.isTypeOf(node, TimelineEntrySchema, { checkSchemaExtensions: true })
  ) {
    return blue.nodeToSchemaOutput(node, TimelineEntrySchema);
  }
  return null;
}

export function isTimelineEventNewer(
  blue: Blue,
  currentEvent: BlueNode,
  lastEvent: BlueNode,
): boolean {
  const current = toTimelineEntry(blue, currentEvent);
  const previous = toTimelineEntry(blue, lastEvent);
  if (!current || !previous) {
    return true;
  }
  const currentTimestamp = current.timestamp;
  const previousTimestamp = previous.timestamp;
  if (
    typeof currentTimestamp !== 'number' ||
    typeof previousTimestamp !== 'number'
  ) {
    return true;
  }
  return currentTimestamp >= previousTimestamp;
}
