import { blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';
import { ContractInput, Contract, contractSchema } from '../contract';
import { actionSchema } from './action';

const baseInitiateContractAction = actionSchema.extend({
  type: blueObjectSchema.extend({
    name: z.literal('Initiate Contract'),
  }),
});

type InitiateContractActionInput = z.input<
  typeof baseInitiateContractAction
> & {
  contract: ContractInput;
};

export type InitiateContractAction = z.output<
  typeof baseInitiateContractAction
> & {
  contract: Contract;
};
export const initiateContractActionSchema: z.ZodType<
  InitiateContractAction,
  z.ZodTypeDef,
  InitiateContractActionInput
> = baseInitiateContractAction.extend({
  contract: z.lazy(() => contractSchema),
});
