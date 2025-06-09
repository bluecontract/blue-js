import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-labs/language';
import { JsonPatchEntrySchema } from './JsonPatchEntry';

export const UpdateDocumentSchema = withTypeBlueId(blueIds['Update Document'])(
  z.object({
    changeset: z.array(JsonPatchEntrySchema),
  })
);

export type UpdateDocument = z.infer<typeof UpdateDocumentSchema>;
