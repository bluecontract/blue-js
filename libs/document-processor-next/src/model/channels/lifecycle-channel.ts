import { z } from 'zod';

import { channelContractBaseSchema } from '../shared/index.js';
import { LifecycleEventChannelSchema as CoreLifecycleEventChannelSchema } from '@blue-repository/core';

export const lifecycleChannelSchema = CoreLifecycleEventChannelSchema.merge(
  channelContractBaseSchema
);

export type LifecycleChannel = z.infer<typeof lifecycleChannelSchema>;
