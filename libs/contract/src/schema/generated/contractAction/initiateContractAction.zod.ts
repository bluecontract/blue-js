// Generated by ts-to-zod
import { z } from 'zod';

import { blueObjectSchema } from '@blue-company/language';
import { contractActionSchema } from './contractAction.zod';
import { contractSchema } from './../contract/contract.zod';

export const initiateContractActionSchema = contractActionSchema.extend({
  type: blueObjectSchema
    .and(
      z.object({
        name: z.literal('Initiate Contract'),
      })
    )
    .optional(),
  contract: contractSchema,
});
