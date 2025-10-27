import { z } from 'zod';

import { markerContractBaseSchema } from '../shared/index.js';
import { ProcessingTerminatedMarkerSchema as CoreProcessingTerminatedMarkerSchema } from '@blue-repository/core';

// TODO: Service based on that type like in JAVA version.

export const processingTerminatedMarkerSchema =
  CoreProcessingTerminatedMarkerSchema.merge(markerContractBaseSchema);

export type ProcessingTerminatedMarker = z.infer<
  typeof processingTerminatedMarkerSchema
>;
