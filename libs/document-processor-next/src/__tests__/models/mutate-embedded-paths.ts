import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const mutateEmbeddedPathsSchema = withTypeBlueId('MutateEmbeddedPaths')(
  handlerContractBaseSchema,
);

export type MutateEmbeddedPaths = z.infer<typeof mutateEmbeddedPathsSchema>;
