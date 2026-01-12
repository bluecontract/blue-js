import { z } from 'zod';

import { EmbeddedNodeChannelSchema as CoreEmbeddedNodeChannelSchema } from '@blue-repository/types/packages/core/schemas/EmbeddedNodeChannel';
import { channelContractBaseSchema } from '../shared/index.js';

export const embeddedNodeChannelSchema = CoreEmbeddedNodeChannelSchema.merge(
  channelContractBaseSchema,
);

export type EmbeddedNodeChannel = z.infer<typeof embeddedNodeChannelSchema>;
