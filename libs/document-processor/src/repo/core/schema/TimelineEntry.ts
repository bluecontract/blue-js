import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId, blueNodeField } from '@blue-labs/language';

export const TimelineEntrySchema = withTypeBlueId(blueIds['Timeline Entry'])(
  z.object({
    timelineId: z.string().optional(),
    timelinePrev: z.string().optional(),
    thread: z.string().optional(),
    threadPrev: z.string().optional(),
    message: blueNodeField().optional(),
    signature: z.string().optional(),
  })
);

export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;
