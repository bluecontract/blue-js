import { z } from 'zod';
import { blueNodeField } from '@blue-labs/language';
import { SequentialWorkflowSchema as ConversationSequentialWorkflowSchema } from '@blue-repository/conversation';

import { handlerContractBaseSchema } from '../shared/handler-contract-base.js';

export const sequentialWorkflowStepSchema = blueNodeField();

export type SequentialWorkflowStep = z.infer<
  typeof sequentialWorkflowStepSchema
>;

export const sequentialWorkflowSchema =
  ConversationSequentialWorkflowSchema.merge(handlerContractBaseSchema).extend({
    steps: z.array(blueNodeField()).optional(),
  });

export type SequentialWorkflow = z.infer<typeof sequentialWorkflowSchema>;
