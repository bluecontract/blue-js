import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { markerContractBaseSchema } from '../shared/index.js';

export const processingTerminatedMarkerSchema = withTypeBlueId(
  'ProcessingTerminatedMarker',
)(
  markerContractBaseSchema.extend({
    cause: z.string(),
    reason: z.string().optional(),
  }),
);

export type ProcessingTerminatedMarker = z.infer<
  typeof processingTerminatedMarkerSchema
>;
