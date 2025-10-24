import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { markerContractBaseSchema } from '../shared/index.js';

export const initializationMarkerSchema = withTypeBlueId('InitializationMarker')(
  markerContractBaseSchema.extend({
    documentId: z.string().optional(),
  }),
);

export type InitializationMarker = z.infer<typeof initializationMarkerSchema>;
