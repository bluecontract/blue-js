import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const mutateEventSchema = withTypeBlueId('MutateEvent')(
  handlerContractBaseSchema
);

export type MutateEvent = z.infer<typeof mutateEventSchema>;
