import { z } from 'zod';

import { ProcessingInitializedMarkerSchema as CoreProcessingInitializedMarkerSchema } from '@blue-repository/core';
import { markerContractBaseSchema } from '../shared/index.js';

export const initializationMarkerSchema =
  CoreProcessingInitializedMarkerSchema.merge(markerContractBaseSchema);

export type InitializationMarker = z.infer<typeof initializationMarkerSchema>;
