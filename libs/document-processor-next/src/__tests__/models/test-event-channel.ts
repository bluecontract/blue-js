import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { channelContractBaseSchema } from '../../model/shared/index.js';

export const testEventChannelSchema = withTypeBlueId('TestEventChannel')(
  channelContractBaseSchema.extend({
    eventType: z.string(),
  })
);

export type TestEventChannel = z.infer<typeof testEventChannelSchema>;
