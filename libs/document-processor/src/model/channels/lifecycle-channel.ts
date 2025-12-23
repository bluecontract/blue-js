import { z } from 'zod';

import { LifecycleEventChannelSchema as CoreLifecycleEventChannelSchema } from '@blue-repository/types/packages/core/schemas/LifecycleEventChannel';
import { channelContractBaseSchema } from '../shared/index.js';

export const lifecycleChannelSchema = CoreLifecycleEventChannelSchema.merge(
  channelContractBaseSchema,
);

export type LifecycleChannel = z.infer<typeof lifecycleChannelSchema>;
