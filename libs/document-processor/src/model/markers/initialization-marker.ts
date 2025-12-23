import { z } from 'zod';

import { ProcessingInitializedMarkerSchema as CoreProcessingInitializedMarkerSchema } from '@blue-repository/types/packages/core/schemas/ProcessingInitializedMarker';
import { markerContractBaseSchema } from '../shared/index.js';

export const initializationMarkerSchema =
  CoreProcessingInitializedMarkerSchema.merge(markerContractBaseSchema);

export type InitializationMarker = z.infer<typeof initializationMarkerSchema>;
