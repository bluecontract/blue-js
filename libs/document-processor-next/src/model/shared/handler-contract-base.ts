import { z } from 'zod';

import { contractBaseSchema } from './contract-base.js';
import { blueNodeSchema } from './node-schema.js';

export const handlerContractBaseSchema = contractBaseSchema.extend({
  channel: z.string().optional(),
  channelKey: z.string().optional(),
  event: blueNodeSchema.optional(),
});

export type HandlerContractBase = z.infer<typeof handlerContractBaseSchema>;
