import { z } from 'zod';

import { markerContractBaseSchema } from '../shared/index.js';
import { ChannelEventCheckpointSchema as CoreChannelEventCheckpointSchema } from '@blue-repository/core';

// TODO: Service based on that type like in JAVA version.

export const channelEventCheckpointSchema =
  CoreChannelEventCheckpointSchema.merge(markerContractBaseSchema).extend({
    lastSignatures: z.record(z.string()).optional(),
  });

export type ChannelEventCheckpoint = z.infer<
  typeof channelEventCheckpointSchema
>;
