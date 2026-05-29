import { z } from 'zod';

import { MyOSTimelineChannelSchema as RepositoryMyOSTimelineChannelSchema } from '@blue-repository/types/packages/myos/schemas/MyOSTimelineChannel';

import { channelContractBaseSchema } from '../shared/index.js';
import type { TimelineChannel } from './timeline-channel.js';

const myosTimelineChannelSchemaBase = RepositoryMyOSTimelineChannelSchema.merge(
  channelContractBaseSchema,
);

export type MyOSTimelineChannel = TimelineChannel & {
  accountId?: string;
  email?: string;
};

export const myosTimelineChannelSchema =
  myosTimelineChannelSchemaBase as z.ZodType<MyOSTimelineChannel>;
