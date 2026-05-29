import { z } from 'zod';

import { TimelineChannelSchema as ConversationTimelineChannelSchema } from '@blue-repository/types/packages/coordination/schemas/TimelineChannel';

import {
  channelContractBaseSchema,
  type ChannelContractBase,
} from '../shared/index.js';

const timelineChannelSchemaBase = ConversationTimelineChannelSchema.merge(
  channelContractBaseSchema,
);

export type TimelineChannel = ChannelContractBase & {
  timelineId?: string;
};

export const timelineChannelSchema =
  timelineChannelSchemaBase as z.ZodType<TimelineChannel>;
