import { z } from 'zod';

import { contractBaseSchema } from './contract-base.js';
import { ChannelSchema as CoreChannelSchema } from '@blue-repository/core';
import { blueNodeField } from '@blue-labs/language';

export const channelContractBaseSchema = CoreChannelSchema.merge(
  contractBaseSchema
).extend({
  path: z.string().optional(),
  definition: blueNodeField().optional(),
});

export type ChannelContractBase = z.infer<typeof channelContractBaseSchema>;
