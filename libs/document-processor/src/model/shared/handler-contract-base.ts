import type { z } from 'zod';
import { contractBaseSchema } from './contract-base.js';
import { HandlerSchema as CoreHandlerSchema } from './core-runtime-schemas.js';

export const handlerContractBaseSchema =
  CoreHandlerSchema.merge(contractBaseSchema);

export type HandlerContractBase = z.infer<typeof handlerContractBaseSchema>;
