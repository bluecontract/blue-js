import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { markerContractBaseSchema } from '../shared/index.js';

// TODO: Service based on that type like in JAVA version.

export const processEmbeddedMarkerSchema = withTypeBlueId('ProcessEmbedded')(
  markerContractBaseSchema.extend({
    paths: z.array(z.string()).optional(),
  })
);

export type ProcessEmbeddedMarker = z.infer<typeof processEmbeddedMarkerSchema>;
