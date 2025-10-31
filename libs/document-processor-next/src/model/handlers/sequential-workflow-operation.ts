import { z } from 'zod';
import { blueNodeField } from '@blue-labs/language';
import { SequentialWorkflowOperationSchema as ConversationSequentialWorkflowOperationSchema } from '@blue-repository/conversation';

import { handlerContractBaseSchema } from '../shared/handler-contract-base.js';

export const sequentialWorkflowOperationSchema =
  ConversationSequentialWorkflowOperationSchema.merge(
    handlerContractBaseSchema,
  ).extend({
    steps: z.array(blueNodeField()).optional(),
  });

export type SequentialWorkflowOperation = z.infer<
  typeof sequentialWorkflowOperationSchema
>;
