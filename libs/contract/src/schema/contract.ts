import { blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';
import { participantSchema } from './participant';
import { workflowSchema } from './workflow';

export const contractSchema = blueObjectSchema.extend({
  participants: blueObjectSchema
    .extend({
      items: z.array(participantSchema),
    })
    .optional(),
  contracts: blueObjectSchema
    .extend({
      items: z.array(blueObjectSchema),
    })
    .optional(),
  properties: z.record(blueObjectSchema).optional(),
  workflows: blueObjectSchema
    .extend({
      items: z.array(workflowSchema),
    })
    .optional(),
});

export type Contract = z.infer<typeof contractSchema>;
