import { z } from 'zod';

import { TriggeredEventChannelSchema as CoreTriggeredEventChannelSchema } from '../shared/core-runtime-schemas.js';
import { channelContractBaseSchema } from '../shared/index.js';

export const triggeredEventChannelSchema =
  CoreTriggeredEventChannelSchema.merge(channelContractBaseSchema);

export type TriggeredEventChannel = z.infer<typeof triggeredEventChannelSchema>;
