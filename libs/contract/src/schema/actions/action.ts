import { blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';

export const actionSchema = blueObjectSchema;

export type Action = z.infer<typeof actionSchema>;
