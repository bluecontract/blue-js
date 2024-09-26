// Generated by ts-to-zod
import { z } from 'zod';

import {
  baseBlueObjectSchema,
  blueObjectSchema,
  blueObjectStringValueSchema,
} from '@blue-company/language';
import { workflowStepObjectListSchema } from './../workflowStep/workflowStep.zod';
import { contractEventBlueObjectSchema } from './../contractEvent/contractEvent.zod';
import { timelineEntrySchema } from './../timeline/timelineEntry.zod';
import { contractBlueIdsSchema, defaultBlueIdsSchema } from './../blueIds.zod';

export const participantTypeSchema = blueObjectSchema.and(
  z.object({
    name: z.literal('Participant').optional(),
  })
);

export const participantSchema = baseBlueObjectSchema.extend({
  type: participantTypeSchema.optional(),
  timeline: blueObjectStringValueSchema.optional(),
  thread: blueObjectStringValueSchema.optional(),
  timelineSource: timelineEntrySchema.optional(),
});

export const participantObjectListSchema = baseBlueObjectSchema.extend({
  items: z.array(participantSchema).optional(),
});

export const contractMessagingSchema = baseBlueObjectSchema.extend({
  participants: blueObjectSchema.optional(),
});

export const contractTypeSchema = blueObjectSchema.and(
  z.object({
    blueId: z.union([
      contractBlueIdsSchema.shape.Contract,
      contractBlueIdsSchema.shape.GenericContract,
    ]),
  })
);

export const contractPhotoSchema = blueObjectStringValueSchema;

export const contractsListObjectSchema = blueObjectSchema;

export const workflowSchema = baseBlueObjectSchema.extend({
  steps: workflowStepObjectListSchema.optional(),
  trigger: contractEventBlueObjectSchema.optional(),
});

export const localContractSchema = baseBlueObjectSchema.extend({
  id: z
    .object({
      type: blueObjectSchema
        .and(
          z.object({
            blueId: defaultBlueIdsSchema.shape.Integer,
          })
        )
        .optional(),
      value: z.number().optional(),
    })
    .optional(),
  type: blueObjectSchema
    .and(
      z.object({
        blueId: contractBlueIdsSchema.shape.LocalContract,
      })
    )
    .optional(),
});

export const workflowObjectListSchema = baseBlueObjectSchema.extend({
  items: z.array(workflowSchema).optional(),
});

export const contractSchema = baseBlueObjectSchema.extend({
  participants: z.record(participantObjectListSchema).optional(),
  workflows: workflowObjectListSchema.optional(),
  properties: blueObjectSchema.optional(),
  photo: contractPhotoSchema.optional(),
  contracts: contractsListObjectSchema.optional(),
  messaging: contractMessagingSchema.optional(),
});
