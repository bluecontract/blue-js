import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';
import { ChannelSchema } from './Channel';

export const TimelineChannelSchema = withTypeBlueId(
  blueIds['Timeline Channel']
)(
  ChannelSchema.extend({
    timelineId: z.string().optional(),
  })
);

export type TimelineChannel = z.infer<typeof TimelineChannelSchema>;
