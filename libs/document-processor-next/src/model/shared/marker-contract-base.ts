import { z } from 'zod';

import { contractBaseSchema } from './contract-base.js';

export const markerContractBaseSchema = contractBaseSchema;

export type MarkerContractBase = z.infer<typeof markerContractBaseSchema>;
