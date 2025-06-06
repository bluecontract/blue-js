import { withTypeBlueId } from '@blue-company/schema-annotations';
import { blueIds } from '../blue-ids';
import { z } from 'zod';

export const SequentialWorkflowStepSchema = withTypeBlueId(
  blueIds['Sequential Workflow Step']
)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  })
);

export type SequentialWorkflowStep = z.infer<
  typeof SequentialWorkflowStepSchema
>;
