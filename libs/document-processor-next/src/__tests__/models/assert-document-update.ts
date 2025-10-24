import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const assertDocumentUpdateSchema = withTypeBlueId(
  'AssertDocumentUpdate'
)(
  handlerContractBaseSchema.extend({
    expectedPath: z.string().optional(),
    expectedOp: z.string().optional(),
    expectedBeforeValue: z.number().int().optional(),
    expectBeforeNull: z.boolean().optional(),
    expectedAfterValue: z.number().int().optional(),
    expectAfterNull: z.boolean().optional(),
  })
);

export type AssertDocumentUpdate = z.infer<typeof assertDocumentUpdateSchema>;
