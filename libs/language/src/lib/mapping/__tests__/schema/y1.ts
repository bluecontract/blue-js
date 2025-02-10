import z from 'zod';
import { x11Schema } from './x11';
import { x12Schema } from './x12';
import { ySchema } from './y';
import { withTypeBlueId } from '../../../../schema/annotations';

export const y1Schema = withTypeBlueId('Y1-BlueId')(
  ySchema.extend({
    x11Field: x11Schema.optional(),
    x12Field: x12Schema.optional(),
    x11ListField: z.array(x11Schema).optional(),
  })
);
