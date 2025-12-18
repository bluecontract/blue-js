import { z } from 'zod';
import { blueNodeField } from '@blue-labs/language';
import { SequentialWorkflowOperationSchema as ConversationSequentialWorkflowOperationSchema } from '@blue-repository/types/packages/conversation/schemas/SequentialWorkflowOperation';

import { handlerContractBaseSchema } from '../shared/index.js';

export const sequentialWorkflowOperationSchema =
  ConversationSequentialWorkflowOperationSchema.merge(
    handlerContractBaseSchema,
  ).extend({
    steps: z.array(blueNodeField()).optional(),
  });

export type SequentialWorkflowOperation = z.infer<
  typeof sequentialWorkflowOperationSchema
>;
