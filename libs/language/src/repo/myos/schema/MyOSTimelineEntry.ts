import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';
import { TimelineEntrySchema } from '@blue-repository/core-dev';

export const MyOSTimelineEntrySchema = withTypeBlueId(
  blueIds['MyOS Timeline Entry']
)(
  TimelineEntrySchema.extend({
    account: z.string().optional(),
    email: z.string().optional(),
  })
);

export type MyOSTimelineEntry = z.infer<typeof MyOSTimelineEntrySchema>;
