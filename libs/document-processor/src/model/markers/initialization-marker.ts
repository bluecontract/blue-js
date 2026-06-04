import { z } from 'zod';

import { ProcessingInitializedMarkerSchema as CoreProcessingInitializedMarkerSchema } from '../shared/core-runtime-schemas.js';
import { markerContractBaseSchema } from '../shared/index.js';

export const initializationMarkerSchema =
  CoreProcessingInitializedMarkerSchema.merge(markerContractBaseSchema);

export type InitializationMarker = z.infer<typeof initializationMarkerSchema>;
