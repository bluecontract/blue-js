import z from 'zod';
import { withTypeBlueId } from '../../annotations';
import { personSchema } from './person';

export const doctorSchema = withTypeBlueId('Doctor-BlueId')(
  personSchema.extend({
    specialization: z.string(),
  })
);
