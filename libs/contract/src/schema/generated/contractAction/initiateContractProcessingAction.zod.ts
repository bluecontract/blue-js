// Generated by ts-to-zod
import { z } from 'zod';

import { blueObjectSchema } from '@blue-company/language';
import { contractActionSchema } from './contractAction.zod';
import { contractSchema } from './../contract/contract.zod';
import { contractBlueIdsSchema } from './../blueIds.zod';
import { timelineEntrySchema } from './../timeline/timelineEntry.zod';

export const initiateContractProcessingActionSchema =
  contractActionSchema.extend({
    type: blueObjectSchema
      .and(
        z.object({
          name: z.literal('Initiate Contract Processing Action').optional(),
          blueId:
            contractBlueIdsSchema.shape.InitiateContractProcessingAction.optional(),
        })
      )
      .optional(),
    contract: contractSchema.optional(),
    initiateContractEntry: timelineEntrySchema.optional(),
  });
