// Generated by ts-to-zod
import { z } from 'zod';

import {
  baseBlueObjectSchema,
  blueObjectSchema,
  blueObjectStringValueSchema,
} from '@blue-company/language';

export const initialTimelineBlueMessageTypeSchema = blueObjectSchema.and(
  z.object({
    name: z.literal('Timeline by Timeline.blue'),
  })
);

export const initialTimelineBlueMessageSchema = baseBlueObjectSchema.extend({
  type: initialTimelineBlueMessageTypeSchema.optional(),
  timelineAlias: blueObjectStringValueSchema,
  avatar: blueObjectStringValueSchema.optional(),
  signingMethod: z.unknown().optional(),
});
