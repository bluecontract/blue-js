import { z } from 'zod';
import { ContractSchema as CoreContractSchema } from '@blue-repository/core';

export const contractBaseSchema = CoreContractSchema.extend({
  key: z.string().min(1).optional(),
});

export type ContractBase = z.infer<typeof contractBaseSchema>;
