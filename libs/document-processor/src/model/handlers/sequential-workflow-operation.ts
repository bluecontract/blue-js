import { z } from 'zod';
import { blueNodeField } from '@blue-labs/language';
import { SequentialWorkflowOperationSchema as ConversationSequentialWorkflowOperationSchema } from '@blue-repository/types/packages/coordination/schemas/SequentialWorkflowOperation';

import { handlerContractBaseSchema } from '../shared/index.js';
import type {
  SequentialWorkflow,
  SequentialWorkflowStep,
} from './sequential-workflow.js';

const sequentialWorkflowOperationSchemaBase =
  ConversationSequentialWorkflowOperationSchema.merge(
    handlerContractBaseSchema,
  ).extend({
    steps: z.array(blueNodeField()).optional(),
  });

export type SequentialWorkflowOperation = SequentialWorkflow & {
  operation?: string;
  steps?: SequentialWorkflowStep[];
};

export const sequentialWorkflowOperationSchema =
  sequentialWorkflowOperationSchemaBase as z.ZodType<SequentialWorkflowOperation>;
