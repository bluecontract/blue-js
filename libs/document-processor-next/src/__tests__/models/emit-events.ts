import { z } from 'zod';
import { blueNodeField, withTypeBlueId } from '@blue-labs/language';

import { handlerContractBaseSchema } from '../../model/shared/index.js';

export const emitEventsSchema = withTypeBlueId('EmitEvents')(
  handlerContractBaseSchema.extend({
    events: z.array(blueNodeField()).optional(),
    expectedKind: z.string().optional(),
  })
);

export type EmitEvents = z.infer<typeof emitEventsSchema>;
