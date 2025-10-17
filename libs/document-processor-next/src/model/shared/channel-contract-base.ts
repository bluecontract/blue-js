import { z } from 'zod';

import { contractBaseSchema } from './contract-base.js';
import { blueNodeSchema } from './node-schema.js';

export const channelContractBaseSchema = contractBaseSchema.extend({
  path: z.string().optional(),
  definition: blueNodeSchema.optional(),
});

export type ChannelContractBase = z.infer<typeof channelContractBaseSchema>;
