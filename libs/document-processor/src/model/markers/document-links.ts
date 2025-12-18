import { z } from 'zod';

import { DocumentLinksSchema as RepositoryDocumentLinksSchema } from '@blue-repository/types/packages/myos/schemas/DocumentLinks';

import { markerContractBaseSchema } from '../shared/index.js';

export const documentLinksMarkerSchema = RepositoryDocumentLinksSchema.merge(
  markerContractBaseSchema,
);

export type DocumentLinksMarker = z.infer<typeof documentLinksMarkerSchema>;
