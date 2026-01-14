import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { channelContractBaseSchema } from '../../model/shared/index.js';

export const recencyTestChannelSchema = withTypeBlueId('RecencyTestChannel')(
  channelContractBaseSchema.extend({
    minDelta: z.number().optional(),
  }),
);

export type RecencyTestChannel = z.infer<typeof recencyTestChannelSchema>;
