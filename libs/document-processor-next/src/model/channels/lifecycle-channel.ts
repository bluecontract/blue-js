import { z } from 'zod';

import { LifecycleEventChannelSchema as CoreLifecycleEventChannelSchema } from '@blue-repository/core';
import { channelContractBaseSchema } from '../shared/index.js';

export const lifecycleChannelSchema = CoreLifecycleEventChannelSchema.merge(
  channelContractBaseSchema,
);

export type LifecycleChannel = z.infer<typeof lifecycleChannelSchema>;
