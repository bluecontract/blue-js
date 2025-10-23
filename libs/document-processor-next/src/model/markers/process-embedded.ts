import { z } from 'zod';

import { markerContractBaseSchema } from '../shared/index.js';
import { ProcessEmbeddedSchema as CoreProcessEmbeddedSchema } from '@blue-repository/core';

// TODO: Service based on that type like in JAVA version.

export const processEmbeddedMarkerSchema = CoreProcessEmbeddedSchema.merge(
  markerContractBaseSchema
);

export type ProcessEmbeddedMarker = z.infer<typeof processEmbeddedMarkerSchema>;
