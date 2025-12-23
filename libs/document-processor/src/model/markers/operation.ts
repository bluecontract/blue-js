import { z } from 'zod';
import { OperationSchema as ConversationOperationSchema } from '@blue-repository/types/packages/conversation/schemas/Operation';

import { markerContractBaseSchema } from '../shared/index.js';

export const operationMarkerSchema = ConversationOperationSchema.merge(
  markerContractBaseSchema,
);

export type OperationMarker = z.infer<typeof operationMarkerSchema>;
