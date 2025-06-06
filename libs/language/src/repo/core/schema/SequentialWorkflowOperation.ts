import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-company/schema-annotations';
import { SequentialWorkflowSchema } from './SequentialWorkflow';

export const SequentialWorkflowOperationSchema = withTypeBlueId(
  blueIds['Sequential Workflow Operation']
)(
  SequentialWorkflowSchema.omit({
    channel: true,
  }).extend({
    operation: z.string().optional(),
  })
);

export type SequentialWorkflowOperation = z.infer<
  typeof SequentialWorkflowOperationSchema
>;
