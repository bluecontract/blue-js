// Generated by ts-to-zod
import { z } from 'zod';

import {
  baseBlueObjectSchema,
  blueObjectSchema,
  blueObjectStringValueSchema,
} from '@blue-company/language';

export const workflowStepObjectListSchema = baseBlueObjectSchema.extend({
  items: z.array(blueObjectSchema).optional(),
});

export const workflowStepSchema = baseBlueObjectSchema.extend({
  condition: blueObjectStringValueSchema.optional(),
});
