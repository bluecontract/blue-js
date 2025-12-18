import type { z } from 'zod';
import { contractBaseSchema } from './contract-base.js';
import { HandlerSchema as CoreHandlerSchema } from '@blue-repository/types/packages/core/schemas/Handler';

export const handlerContractBaseSchema =
  CoreHandlerSchema.merge(contractBaseSchema);

export type HandlerContractBase = z.infer<typeof handlerContractBaseSchema>;
