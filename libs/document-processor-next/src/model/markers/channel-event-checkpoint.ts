import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { markerContractBaseSchema } from '../shared/index.js';

export const channelEventCheckpointSchema = withTypeBlueId(
  'ChannelEventCheckpoint',
)(
  markerContractBaseSchema.extend({
    lastEvents: z
      .record(z.unknown())
      .optional()
      .transform((events) => events ?? {}),
    lastSignatures: z
      .record(z.string())
      .optional()
      .transform((signatures) => signatures ?? {}),
  }),
);

export type ChannelEventCheckpoint = z.infer<
  typeof channelEventCheckpointSchema
>;
