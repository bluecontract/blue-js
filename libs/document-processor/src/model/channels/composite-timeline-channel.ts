import { z } from 'zod';

import { CompositeTimelineChannelSchema as ConversationCompositeTimelineChannelSchema } from '@blue-repository/types/packages/conversation/schemas/CompositeTimelineChannel';

import { channelContractBaseSchema } from '../shared/index.js';

export const compositeTimelineChannelSchema =
  ConversationCompositeTimelineChannelSchema.merge(channelContractBaseSchema);

export type CompositeTimelineChannel = z.infer<
  typeof compositeTimelineChannelSchema
>;
