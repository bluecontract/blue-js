import { z } from 'zod';

import { DocumentUpdateChannelSchema } from '@blue-repository/core';
import { channelContractBaseSchema } from '../shared/index.js';

export const documentUpdateChannelSchema = DocumentUpdateChannelSchema.merge(
  channelContractBaseSchema,
);

export type DocumentUpdateChannel = z.infer<typeof documentUpdateChannelSchema>;
