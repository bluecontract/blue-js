import { blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';
import { eventSchema } from './event';
import { workflowStepSchema } from './workflowStep';

export const workflowSchema = blueObjectSchema
  .extend({
    steps: blueObjectSchema
      .extend({
        items: z.array(workflowStepSchema),
      })
      .optional(),
    trigger: eventSchema.optional(),
  })
  .strip();

export type Workflow = z.infer<typeof workflowSchema>;
