import { z } from 'zod';
import { channelContractBaseSchema } from '../shared/index.js';
import { TriggeredEventChannelSchema as CoreTriggeredEventChannelSchema } from '@blue-repository/core';

export const triggeredEventChannelSchema =
  CoreTriggeredEventChannelSchema.merge(channelContractBaseSchema);

export type TriggeredEventChannel = z.infer<typeof triggeredEventChannelSchema>;
