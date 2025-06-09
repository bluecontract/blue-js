import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-labs/language';
import { TimelineEntrySchema } from '../../core/schema/TimelineEntry';

export const MyOSTimelineEntrySchema = withTypeBlueId(
  blueIds['MyOS Timeline Entry']
)(
  TimelineEntrySchema.extend({
    account: z.string().optional(),
    email: z.string().optional(),
  })
);

export type MyOSTimelineEntry = z.infer<typeof MyOSTimelineEntrySchema>;
