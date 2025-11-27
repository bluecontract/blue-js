import { z } from 'zod';

import { DocumentAnchorsSchema as RepositoryDocumentAnchorsSchema } from '@blue-repository/myos';

import { markerContractBaseSchema } from '../shared/index.js';

export const documentAnchorsMarkerSchema =
  RepositoryDocumentAnchorsSchema.merge(markerContractBaseSchema);

export type DocumentAnchorsMarker = z.infer<typeof documentAnchorsMarkerSchema>;
