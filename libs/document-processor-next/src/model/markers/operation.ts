import { z } from 'zod';
import { OperationSchema as ConversationOperationSchema } from '@blue-repository/conversation';

import { markerContractBaseSchema } from '../shared/marker-contract-base.js';

export const operationMarkerSchema = ConversationOperationSchema.merge(
  markerContractBaseSchema,
);

export type OperationMarker = z.infer<typeof operationMarkerSchema>;
