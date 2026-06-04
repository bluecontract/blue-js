import { z } from 'zod';
import { blueNodeField, type BlueNode } from '@blue-labs/language';

import { ChannelEventCheckpointSchema as CoreChannelEventCheckpointSchema } from '../shared/core-runtime-schemas.js';
import { markerContractBaseSchema } from '../shared/index.js';

// TODO: Service based on that type like in JAVA version.

export const channelEventCheckpointSchema =
  CoreChannelEventCheckpointSchema.merge(markerContractBaseSchema).extend({
    lastEvents: z.record(blueNodeField()).optional(),
  });

export type ChannelEventCheckpoint = z.infer<
  typeof channelEventCheckpointSchema
> & {
  lastEvents?: Record<string, BlueNode | null>;
};
