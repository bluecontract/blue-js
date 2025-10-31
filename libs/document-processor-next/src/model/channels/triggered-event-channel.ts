import { z } from 'zod';

import { TriggeredEventChannelSchema as CoreTriggeredEventChannelSchema } from '@blue-repository/core';
import { channelContractBaseSchema } from '../shared/index.js';

export const triggeredEventChannelSchema =
  CoreTriggeredEventChannelSchema.merge(channelContractBaseSchema);

export type TriggeredEventChannel = z.infer<typeof triggeredEventChannelSchema>;
