import { z } from 'zod';

import { MyOSTimelineChannelSchema as RepositoryMyOSTimelineChannelSchema } from '@blue-repository/types/packages/myos/schemas/MyOSTimelineChannel';

import { channelContractBaseSchema } from '../shared/index.js';

export const myosTimelineChannelSchema =
  RepositoryMyOSTimelineChannelSchema.merge(channelContractBaseSchema);

export type MyOSTimelineChannel = z.infer<typeof myosTimelineChannelSchema>;
