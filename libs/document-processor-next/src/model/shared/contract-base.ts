import { z } from 'zod';
import { ContractSchema as CoreContractSchema } from '@blue-repository/core';

export const contractBaseSchema = CoreContractSchema;

export type ContractBase = z.infer<typeof contractBaseSchema>;
