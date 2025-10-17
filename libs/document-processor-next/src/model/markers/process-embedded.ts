import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { markerContractBaseSchema } from '../shared/index.js';

export const processEmbeddedMarkerSchema = withTypeBlueId('ProcessEmbedded')(
  markerContractBaseSchema.extend({
    paths: z
      .array(z.string())
      .optional()
      .transform((paths) => (paths ?? []) as ReadonlyArray<string>),
  }),
);

export type ProcessEmbeddedMarker = z.infer<typeof processEmbeddedMarkerSchema>;
