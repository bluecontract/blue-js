import { z } from 'zod';

import { markerContractBaseSchema } from '../shared/index.js';
import { ProcessingInitializedMarkerSchema as CoreProcessingInitializedMarkerSchema } from '@blue-repository/core';

export const initializationMarkerSchema =
  CoreProcessingInitializedMarkerSchema.merge(markerContractBaseSchema);

export type InitializationMarker = z.infer<typeof initializationMarkerSchema>;
