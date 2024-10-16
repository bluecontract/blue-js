// Generated by ts-to-zod
import { z } from 'zod';

import { timelineEntrySchema } from './../timeline/timelineEntry.zod';
import { contractInstanceBlueObjectSchema } from './../contractInstance/contractInstance.zod';
import {
  baseBlueObjectSchema,
  blueObjectSchema,
  blueObjectNumberValueSchema,
} from '@blue-company/language';
import { contractBlueIdsSchema } from './../blueIds.zod';

export const contractUpdateActionSchema = baseBlueObjectSchema.extend({
  type: blueObjectSchema
    .and(
      z.object({
        name: z.literal('Contract Update Action').optional(),
        blueId: contractBlueIdsSchema.shape.ContractUpdateAction.optional(),
      })
    )
    .optional(),
  contractInstance: contractInstanceBlueObjectSchema.optional(),
  contractInstancePrev: baseBlueObjectSchema.optional(),
  epoch: blueObjectNumberValueSchema.optional(),
  emittedEvents: blueObjectSchema.optional(),
  initiateContractEntry: timelineEntrySchema.optional(),
  initiateContractProcessingEntry: timelineEntrySchema.optional(),
});
