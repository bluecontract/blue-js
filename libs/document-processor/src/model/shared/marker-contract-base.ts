import { z } from 'zod';

import { contractBaseSchema } from './contract-base.js';
import { MarkerSchema as CoreMarkerSchema } from '@blue-repository/types/packages/core/schemas/Marker';

export const markerContractBaseSchema =
  CoreMarkerSchema.merge(contractBaseSchema);

export type MarkerContractBase = z.infer<typeof markerContractBaseSchema>;
