import type { z } from 'zod';
import { contractBaseSchema } from './contract-base.js';
import { HandlerSchema as CoreHandlerSchema } from '@blue-repository/core';

export const handlerContractBaseSchema =
  CoreHandlerSchema.merge(contractBaseSchema);

export type HandlerContractBase = z.infer<typeof handlerContractBaseSchema>;
