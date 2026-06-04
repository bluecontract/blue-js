import { z } from 'zod';

import { DocumentUpdateChannelSchema } from '../shared/core-runtime-schemas.js';
import { channelContractBaseSchema } from '../shared/index.js';

export const documentUpdateChannelSchema = DocumentUpdateChannelSchema.merge(
  channelContractBaseSchema,
);

export type DocumentUpdateChannel = z.infer<typeof documentUpdateChannelSchema>;
