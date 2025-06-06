import { z } from 'zod';
import { blueNodeField } from '@blue-company/schema-annotations';
import { withTypeBlueId } from '@blue-company/schema-annotations';
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
