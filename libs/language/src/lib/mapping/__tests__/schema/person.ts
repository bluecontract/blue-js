import z from 'zod';
import { withTypeBlueId } from '../../../../schema/annotations';

export const personSchema = withTypeBlueId('Person-BlueId')(
  z.object({
    name: z.string(),
    surname: z.string().optional(),
    age: z.number().optional(),
  }),
);
