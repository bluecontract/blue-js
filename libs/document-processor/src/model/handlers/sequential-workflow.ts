import { z } from 'zod';
import { blueNodeField } from '@blue-labs/language';
import { SequentialWorkflowSchema as ConversationSequentialWorkflowSchema } from '@blue-repository/types/packages/coordination/schemas/SequentialWorkflow';

import {
  handlerContractBaseSchema,
  type HandlerContractBase,
} from '../shared/index.js';

export const sequentialWorkflowStepSchema = blueNodeField();

export type SequentialWorkflowStep = z.infer<
  typeof sequentialWorkflowStepSchema
>;

const sequentialWorkflowSchemaBase = ConversationSequentialWorkflowSchema.merge(
  handlerContractBaseSchema,
).extend({
  steps: z.array(blueNodeField()).optional(),
});

export type SequentialWorkflow = HandlerContractBase & {
  steps?: SequentialWorkflowStep[];
};

export const sequentialWorkflowSchema =
  sequentialWorkflowSchemaBase as z.ZodType<SequentialWorkflow>;
