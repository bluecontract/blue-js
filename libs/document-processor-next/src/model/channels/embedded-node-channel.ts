import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { channelContractBaseSchema } from '../shared/index.js';

export const embeddedNodeChannelSchema = withTypeBlueId('EmbeddedNodeChannel')(
  channelContractBaseSchema.extend({
    childPath: z.string(),
  }),
);

export type EmbeddedNodeChannel = z.infer<typeof embeddedNodeChannelSchema>;
