import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const cutOffProbeSchema = withTypeBlueId('CutOffProbe')(
  handlerContractBaseSchema.extend({
    emitBefore: z.boolean().optional(),
    preEmitKind: z.string().optional(),
    patchPointer: z.string().optional(),
    patchValue: z.number().int().optional(),
    emitAfter: z.boolean().optional(),
    postEmitKind: z.string().optional(),
    postPatchPointer: z.string().optional(),
    postPatchValue: z.number().int().optional(),
  })
);

export type CutOffProbe = z.infer<typeof cutOffProbeSchema>;
