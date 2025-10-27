import { z } from 'zod';

import { channelContractBaseSchema } from '../shared/index.js';
import { EmbeddedNodeChannelSchema as CoreEmbeddedNodeChannelSchema } from '@blue-repository/core';

export const embeddedNodeChannelSchema = CoreEmbeddedNodeChannelSchema.merge(
  channelContractBaseSchema
);

export type EmbeddedNodeChannel = z.infer<typeof embeddedNodeChannelSchema>;
