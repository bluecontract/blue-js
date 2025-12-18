import { z } from 'zod';

import { MyOSParticipantsOrchestrationSchema } from '@blue-repository/types/packages/myos/schemas/MyOSParticipantsOrchestration';

import { markerContractBaseSchema } from '../shared/index.js';

export const myosParticipantsOrchestrationMarkerSchema =
  MyOSParticipantsOrchestrationSchema.merge(markerContractBaseSchema);

export type MyOSParticipantsOrchestrationMarker = z.infer<
  typeof myosParticipantsOrchestrationMarkerSchema
>;
