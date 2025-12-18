import { z } from 'zod';

import { TimelineChannelSchema as ConversationTimelineChannelSchema } from '@blue-repository/types/packages/conversation/schemas/TimelineChannel';

import { channelContractBaseSchema } from '../shared/index.js';

export const timelineChannelSchema = ConversationTimelineChannelSchema.merge(
  channelContractBaseSchema,
);

export type TimelineChannel = z.infer<typeof timelineChannelSchema>;
