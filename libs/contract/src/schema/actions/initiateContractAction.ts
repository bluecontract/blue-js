import { BlueObject, blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';
import { Contract, contractSchema } from '../contract';
import { Merge, MergeDeep } from 'type-fest';
import { Action, actionSchema } from './action';

export type InitiateContractAction = MergeDeep<
  Action,
  {
    type: Merge<BlueObject, { name: 'Initiate Contract' }>;
    contract: Contract;
  }
>;

export const initiateContractActionSchema: z.ZodType<InitiateContractAction> =
  actionSchema.extend({
    type: blueObjectSchema.extend({
      name: z.literal('Initiate Contract'),
    }),
    contract: contractSchema,
  });
