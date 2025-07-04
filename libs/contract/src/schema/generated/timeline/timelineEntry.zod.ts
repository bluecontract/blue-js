// Generated by ts-to-zod
import { z } from 'zod';

import {
  baseBlueObjectSchema,
  blueObjectSchema,
  blueObjectStringValueSchema,
} from '@blue-labs/language';
import { contractBlueIdsSchema } from './../blueIds.zod';

export const timelineEntrySchema = baseBlueObjectSchema.extend({
  type: blueObjectSchema
    .and(
      z.object({
        name: z.literal('Timeline Entry').optional(),
        blueId: contractBlueIdsSchema.shape.TimelineEntry.optional(),
      })
    )
    .optional(),
  timeline: baseBlueObjectSchema.optional(),
  timelinePrev: baseBlueObjectSchema.optional(),
  thread: baseBlueObjectSchema.optional(),
  threadPrev: baseBlueObjectSchema.optional(),
  message: blueObjectSchema.optional(),
  signature: blueObjectStringValueSchema.optional(),
});
