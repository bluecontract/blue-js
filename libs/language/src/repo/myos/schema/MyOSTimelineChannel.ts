import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';
import { TimelineChannelSchema } from '@blue-repository/core-dev';

export const MyOSTimelineChannelSchema = withTypeBlueId(
  blueIds['MyOS Timeline Channel']
)(
  TimelineChannelSchema.extend({
    account: z.string().optional(),
    email: z.string().optional(),
  })
);

export type MyOSTimelineChannel = z.infer<typeof MyOSTimelineChannelSchema>;
