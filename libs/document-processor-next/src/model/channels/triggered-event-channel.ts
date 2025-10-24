import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { channelContractBaseSchema } from '../shared/index.js';

export const triggeredEventChannelSchema = withTypeBlueId(
  'TriggeredEventChannel'
)(channelContractBaseSchema);

export type TriggeredEventChannel = z.infer<typeof triggeredEventChannelSchema>;
