import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { channelContractBaseSchema } from '../shared/index.js';

export const documentUpdateChannelSchema = withTypeBlueId('DocumentUpdateChannel')(
  channelContractBaseSchema.extend({
    path: z.string(),
  }),
);

export type DocumentUpdateChannel = z.infer<typeof documentUpdateChannelSchema>;
