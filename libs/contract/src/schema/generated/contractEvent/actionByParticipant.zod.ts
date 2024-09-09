// Generated by ts-to-zod
import { z } from 'zod';

import {
  blueObjectSchema,
  blueObjectStringValueSchema,
} from '@blue-company/language';
import { contractEventSchema } from './contractEvent.zod';
import { initiateContractActionSchema } from './../contractAction/initiateContractAction.zod';

export const actionByParticipantEventSchema = contractEventSchema.extend({
  type: blueObjectSchema
    .and(
      z.object({
        name: z.literal('Action by Participant'),
      })
    )
    .optional(),
  participant: blueObjectStringValueSchema,
  action: initiateContractActionSchema,
});
