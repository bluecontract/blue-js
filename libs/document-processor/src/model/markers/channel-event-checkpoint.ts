import { z } from 'zod';

import { ChannelEventCheckpointSchema as CoreChannelEventCheckpointSchema } from '@blue-repository/types/packages/core/schemas/ChannelEventCheckpoint';
import { markerContractBaseSchema } from '../shared/index.js';

// TODO: Service based on that type like in JAVA version.

export const channelEventCheckpointSchema =
  CoreChannelEventCheckpointSchema.merge(markerContractBaseSchema).extend({
    lastSignatures: z.record(z.string()).optional(),
  });

export type ChannelEventCheckpoint = z.infer<
  typeof channelEventCheckpointSchema
>;
