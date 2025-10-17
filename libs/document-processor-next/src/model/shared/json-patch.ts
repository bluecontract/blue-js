import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { blueNodeSchema } from './node-schema.js';

const jsonPatchBaseSchema = z.object({
  op: z.enum(['ADD', 'REPLACE', 'REMOVE']),
  path: z.string(),
  val: blueNodeSchema.optional(),
});

export const jsonPatchSchema = withTypeBlueId('JsonPatch')(
  jsonPatchBaseSchema.superRefine((value, ctx) => {
    if (value.op === 'REMOVE' && value.val !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REMOVE operations cannot include a value',
        path: ['val'],
      });
    }
    if (value.op !== 'REMOVE' && value.val === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.op} operations must include a value`,
        path: ['val'],
      });
    }
  }),
);

export type JsonPatch = z.infer<typeof jsonPatchSchema>;
