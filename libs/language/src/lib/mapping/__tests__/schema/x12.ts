import z from 'zod';
import { x1Schema } from './x1';
import { withTypeBlueId } from '../../../../schema/annotations';

export const x12Schema = withTypeBlueId('X12-BlueId')(
  x1Schema.extend({
    stringQueueField: z.array(z.string()).optional(),
    integerDequeField: z.array(z.number()).optional(),
  }),
);
