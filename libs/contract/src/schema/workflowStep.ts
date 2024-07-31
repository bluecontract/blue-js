import { blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';

export const workflowStepSchema = blueObjectSchema;

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
