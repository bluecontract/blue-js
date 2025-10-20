import { z } from 'zod';

import { contractBaseSchema } from './contract-base.js';
import { blueNodeField } from '@blue-labs/language';

export const channelContractBaseSchema = contractBaseSchema.extend({
  path: z.string().optional(),
  definition: blueNodeField().optional(),
});

export type ChannelContractBase = z.infer<typeof channelContractBaseSchema>;
