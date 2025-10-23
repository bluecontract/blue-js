import { DocumentUpdateChannelSchema } from '@blue-repository/core';
import { channelContractBaseSchema } from '../shared/index.js';
import { z } from 'zod';

export const documentUpdateChannelSchema = DocumentUpdateChannelSchema.merge(
  channelContractBaseSchema
);

export type DocumentUpdateChannel = z.infer<typeof documentUpdateChannelSchema>;
