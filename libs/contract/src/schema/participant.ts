import { blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';

export const participantSchema = blueObjectSchema;

export type Participant = z.infer<typeof participantSchema>;
