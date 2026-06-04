import { z } from 'zod';

import { LifecycleEventChannelSchema as CoreLifecycleEventChannelSchema } from '../shared/core-runtime-schemas.js';
import { channelContractBaseSchema } from '../shared/index.js';

export const lifecycleChannelSchema = CoreLifecycleEventChannelSchema.merge(
  channelContractBaseSchema,
);

export type LifecycleChannel = z.infer<typeof lifecycleChannelSchema>;
