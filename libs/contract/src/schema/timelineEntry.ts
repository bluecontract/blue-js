import { z } from 'zod';
import {
  blueObjectSchema,
  blueObjectStringValueSchema,
} from '@blue-company/language';

export const timelineEntrySchema = z.object({
  id: blueObjectStringValueSchema,
  // created: z.union([z.string(), z.number(), z.date()]).transform((v) => {
  //   if (isDate(v)) return v.toISOString();
  //   return new Date(v).toISOString();
  // }),
  created: z.unknown(),
  timeline: blueObjectStringValueSchema.optional(),
  timelinePrev: blueObjectStringValueSchema.optional().nullable(),
  thread: blueObjectStringValueSchema.optional().nullable(),
  threadPrev: blueObjectStringValueSchema.optional().nullable(),
  message: blueObjectSchema,
  signature: blueObjectStringValueSchema,
});

export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
