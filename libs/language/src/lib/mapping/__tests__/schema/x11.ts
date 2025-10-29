import z from 'zod';
import { x1Schema } from './x1';
import { withTypeBlueId } from '../../../../schema/annotations';

export const x11Schema = withTypeBlueId('X11-BlueId')(
  x1Schema.extend({
    nestedListField: z.array(z.array(z.string())).optional(),
    complexMapField: z.map(z.string(), z.array(z.number())).optional(),
  }),
);
