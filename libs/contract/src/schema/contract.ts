import { blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';
import { workflowSchema } from './workflow';
import { participantObjectListSchema } from './participant';

const participantsRecordSchema = z.record(participantObjectListSchema);

export const contractSchema = blueObjectSchema
  .extend({
    participants: participantsRecordSchema.optional(),
    contracts: blueObjectSchema
      .extend({
        items: z.array(blueObjectSchema).optional(),
      })
      .strip()
      .optional(),
    properties: blueObjectSchema.optional(),
    workflows: blueObjectSchema
      .extend({
        items: z.array(workflowSchema).optional(),
      })
      .strip()
      .optional(),
    photo: blueObjectSchema
      .extend({
        value: z.string().optional(),
      })
      .strip()
      .optional(),
  })
  .strip();

export type ContractInput = z.input<typeof contractSchema>;
export type Contract = z.infer<typeof contractSchema>;
