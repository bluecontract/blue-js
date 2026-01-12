import { z } from 'zod';

import { DocumentUpdateChannelSchema } from '@blue-repository/types/packages/core/schemas/DocumentUpdateChannel';
import { channelContractBaseSchema } from '../shared/index.js';

export const documentUpdateChannelSchema = DocumentUpdateChannelSchema.merge(
  channelContractBaseSchema,
);

export type DocumentUpdateChannel = z.infer<typeof documentUpdateChannelSchema>;
