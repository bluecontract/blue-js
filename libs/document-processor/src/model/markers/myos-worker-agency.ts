import { z } from 'zod';

import { MyOSWorkerAgencySchema } from '@blue-repository/myos';

import { markerContractBaseSchema } from '../shared/index.js';

export const myosWorkerAgencyMarkerSchema = MyOSWorkerAgencySchema.merge(
  markerContractBaseSchema,
);

export type MyOSWorkerAgencyMarker = z.infer<
  typeof myosWorkerAgencyMarkerSchema
>;
