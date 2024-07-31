import {
  blueObjectSchema,
  blueObjectStringValueSchema,
} from '@blue-company/language';
import { z } from 'zod';

export const participantTypeSchema = blueObjectSchema.extend({
  name: z.literal('Participant'),
});

export const participantSchema = blueObjectSchema.extend({
  type: participantTypeSchema,
  timeline: blueObjectStringValueSchema.strip().optional(),
  thread: blueObjectStringValueSchema.strip().optional(),
  timelineSource: z.unknown().optional(),
});

export type Participant = z.infer<typeof participantSchema>;

export const participantObjectListSchema = blueObjectSchema.extend({
  items: z.array(participantSchema).optional(),
});

export type ParticipantObjectList = z.infer<typeof participantObjectListSchema>;
