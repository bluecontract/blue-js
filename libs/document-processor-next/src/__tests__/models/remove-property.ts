import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const removePropertySchema = withTypeBlueId('RemoveProperty')(
  handlerContractBaseSchema.extend({
    propertyKey: z.string(),
  })
);

export type RemoveProperty = z.infer<typeof removePropertySchema>;
