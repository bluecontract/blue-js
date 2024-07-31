import { z } from 'zod';
import { workflowSchema } from '../workflow';

export const workflowInstanceSchema = z.object({
  id: z.number(),
  workflow: workflowSchema,
  currentStepName: z.string(),
  finished: z.boolean(),
});

export type WorkflowInstance = z.infer<typeof workflowInstanceSchema>;
