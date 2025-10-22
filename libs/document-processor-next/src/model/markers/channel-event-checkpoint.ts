import { z } from 'zod';
import { blueNodeField, withTypeBlueId } from '@blue-labs/language';

import { markerContractBaseSchema } from '../shared/index.js';

// TODO: Service based on that type like in JAVA version.

export const channelEventCheckpointSchema = withTypeBlueId(
  'ChannelEventCheckpoint'
)(
  markerContractBaseSchema.extend({
    lastEvents: z.record(blueNodeField().nullable()).optional(),
    lastSignatures: z.record(z.string()).optional(),
  })
);

export type ChannelEventCheckpoint = z.infer<
  typeof channelEventCheckpointSchema
>;
