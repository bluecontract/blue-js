import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const terminateScopeSchema = withTypeBlueId('TerminateScope')(
  handlerContractBaseSchema.extend({
    mode: z.string().optional(),
    reason: z.string().optional(),
    emitAfter: z.boolean().optional(),
    patchAfter: z.boolean().optional(),
  }),
);

export type TerminateScope = z.infer<typeof terminateScopeSchema>;
