import { z } from 'zod';
import { xSchema } from './x';
import { withTypeBlueId } from '@blue-company/schema-annotations';

export const x1Schema = withTypeBlueId('X1-BlueId')(
  xSchema.extend({
    intArrayField: z.array(z.number()).optional(),
    stringListField: z.array(z.string()).optional(),
    integerSetField: z.set(z.number()).optional(),
  })
);
