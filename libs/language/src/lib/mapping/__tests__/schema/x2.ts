import { z } from 'zod';
import { xSchema } from './x';
import { withTypeBlueId } from '@blue-company/schema-annotations';

export const x2Schema = withTypeBlueId('X2-BlueId')(
  xSchema.extend({
    stringIntMapField: z.map(z.string(), z.number()).optional(),
  })
);
