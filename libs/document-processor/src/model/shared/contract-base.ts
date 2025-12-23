import { z } from 'zod';
import { ContractSchema as CoreContractSchema } from '@blue-repository/types/packages/core/schemas/Contract';

export const contractBaseSchema = CoreContractSchema;

export type ContractBase = z.infer<typeof contractBaseSchema>;
