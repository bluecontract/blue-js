import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { markerContractBaseSchema } from '../shared/index.js';

export const processingFailureMarkerSchema = withTypeBlueId(
  'ProcessingFailureMarker',
)(
  markerContractBaseSchema.extend({
    code: z.string(),
    reason: z.string().optional(),
  }),
);

export type ProcessingFailureMarker = z.infer<
  typeof processingFailureMarkerSchema
>;
