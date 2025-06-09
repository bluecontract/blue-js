import { z } from 'zod';
import { blueNodeField, withTypeBlueId } from '@blue-labs/language';
import { blueIds } from '../blue-ids';

export const JsonPatchEntrySchema = withTypeBlueId(blueIds['Json Patch Entry'])(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    val: blueNodeField().optional(),
    op: z.string().optional(),
    path: z.string().optional(),
  })
);

export type JsonPatchEntry = z.infer<typeof JsonPatchEntrySchema>;
