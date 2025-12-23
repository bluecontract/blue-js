import { z } from 'zod';

import { MyOSSessionInteractionSchema } from '@blue-repository/types/packages/myos/schemas/MyOSSessionInteraction';

import { markerContractBaseSchema } from '../shared/index.js';

export const myosSessionInteractionMarkerSchema =
  MyOSSessionInteractionSchema.merge(markerContractBaseSchema);

export type MyOSSessionInteractionMarker = z.infer<
  typeof myosSessionInteractionMarkerSchema
>;
