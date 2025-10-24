import { z } from 'zod';

import { contractBaseSchema } from './contract-base.js';
import { blueNodeField } from '@blue-labs/language';

export const handlerContractBaseSchema = contractBaseSchema.extend({
  channel: z.string().optional(),
  channelKey: z.string().optional(),
  event: blueNodeField().optional(),
});

export type HandlerContractBase = z.infer<typeof handlerContractBaseSchema>;
