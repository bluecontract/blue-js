import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId, blueNodeField } from '@blue-labs/language';

export const SequentialWorkflowSchema = withTypeBlueId(
  blueIds['Sequential Workflow']
)(
  z.object({
    steps: z.array(blueNodeField()).optional(),
    channel: z.string().optional(),
  })
);

export type SequentialWorkflow = z.infer<typeof SequentialWorkflowSchema>;
