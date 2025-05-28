import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';

export const TimelineEntrySchema = withTypeBlueId(blueIds['Timeline Entry'])(
  z.object({
    timelineId: z.string().optional(),
    timelinePrev: z.string().optional(),
    thread: z.string().optional(),
    threadPrev: z.string().optional(),
    message: z.unknown(),
    signature: z.string().optional(),
  })
);

export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;
