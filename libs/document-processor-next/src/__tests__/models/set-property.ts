import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const setPropertySchema = withTypeBlueId('SetProperty')(
  handlerContractBaseSchema.extend({
    propertyKey: z.string(),
    propertyValue: z.number().int(),
    path: z.string().optional(),
  })
);

export type SetProperty = z.infer<typeof setPropertySchema>;
