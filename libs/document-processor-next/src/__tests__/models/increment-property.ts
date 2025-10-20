import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const incrementPropertySchema = withTypeBlueId('IncrementProperty')(
  handlerContractBaseSchema.extend({
    propertyKey: z.string(),
  })
);

export type IncrementProperty = z.infer<typeof incrementPropertySchema>;
