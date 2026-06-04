import { z } from 'zod';
import { ContractSchema as CoreContractSchema } from './core-runtime-schemas.js';

export const contractBaseSchema = CoreContractSchema;

export type ContractBase = z.infer<typeof contractBaseSchema>;
