import { blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';
import { eventSchema } from './event';

export const workflowSchema = blueObjectSchema.extend({
  steps: blueObjectSchema
    .extend({
      items: z.array(blueObjectSchema),
    })
    .optional(),
  trigger: eventSchema.optional(),
});

export type Workflow = z.infer<typeof workflowSchema>;
