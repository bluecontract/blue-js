import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';
import { SequentialWorkflowStepSchema } from './SequentialWorkflowStep';

export const SequentialWorkflowSchema = withTypeBlueId(
  blueIds['Sequential Workflow']
)(
  z.object({
    steps: z.array(SequentialWorkflowStepSchema).optional(),
    channel: z.string().optional(),
  })
);

export type SequentialWorkflow = z.infer<typeof SequentialWorkflowSchema>;
