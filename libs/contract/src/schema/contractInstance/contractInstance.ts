import { z } from 'zod';
import { contractSchema } from '../contract';

const baseProcessingStateSchema = z.object({
  startedWorkflowCount: z.number(),
  startedLocalContractCount: z.number(),
});

type ProcessingStateInput = z.input<typeof baseProcessingStateSchema> & {
  localContractInstances?: ContractInstanceInput[];
};

export type ProcessingState = z.output<typeof baseProcessingStateSchema> & {
  localContractInstances?: ContractInstance[];
};

export const processingStateSchema: z.ZodType<
  ProcessingState,
  z.ZodObjectDef,
  ProcessingStateInput
> = baseProcessingStateSchema.extend({
  localContractInstances: z.lazy(() =>
    z.array(contractInstanceSchema).optional()
  ),
});

export const contractInstanceSchema = z.object({
  id: z.number(),
  contractState: contractSchema,
  processingState: processingStateSchema,
});

export type ContractInstanceInput = z.input<typeof contractInstanceSchema>;

export type ContractInstance = z.infer<typeof contractInstanceSchema>;
