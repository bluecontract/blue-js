import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const setPropertyOnEventSchema = withTypeBlueId('SetPropertyOnEvent')(
  handlerContractBaseSchema.extend({
    expectedKind: z.string().optional(),
    propertyKey: z.string(),
    propertyValue: z.number().int(),
  }),
);

export type SetPropertyOnEvent = z.infer<typeof setPropertyOnEventSchema>;
