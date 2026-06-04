import { z } from 'zod';

import { CompositeTimelineChannelSchema as ConversationCompositeTimelineChannelSchema } from '@blue-repository/types/packages/coordination/schemas/CompositeTimelineChannel';

import {
  channelContractBaseSchema,
  type ChannelContractBase,
} from '../shared/index.js';

const compositeTimelineChannelSchemaBase =
  ConversationCompositeTimelineChannelSchema.merge(channelContractBaseSchema);

export type CompositeTimelineChannel = ChannelContractBase & {
  channels?: string[];
};

export const compositeTimelineChannelSchema =
  compositeTimelineChannelSchemaBase as z.ZodType<CompositeTimelineChannel>;
