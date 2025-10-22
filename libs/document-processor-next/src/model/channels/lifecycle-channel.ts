import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { channelContractBaseSchema } from '../shared/index.js';

export const lifecycleChannelSchema = withTypeBlueId('LifecycleChannel')(
  channelContractBaseSchema
);

export type LifecycleChannel = z.infer<typeof lifecycleChannelSchema>;
