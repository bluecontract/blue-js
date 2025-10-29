import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const removeIfPresentSchema = withTypeBlueId('RemoveIfPresent')(
  handlerContractBaseSchema.extend({
    propertyKey: z.string(),
  }),
);

export type RemoveIfPresent = z.infer<typeof removeIfPresentSchema>;
