import { z } from 'zod';

import { EmbeddedNodeChannelSchema as CoreEmbeddedNodeChannelSchema } from '@blue-repository/core';
import { channelContractBaseSchema } from '../shared/index.js';

export const embeddedNodeChannelSchema = CoreEmbeddedNodeChannelSchema.merge(
  channelContractBaseSchema,
);

export type EmbeddedNodeChannel = z.infer<typeof embeddedNodeChannelSchema>;
