import z from 'zod';
import { withTypeBlueId } from '../../annotations';
import { personSchema } from './person';

export const nurseSchema = withTypeBlueId('Nurse-BlueId')(
  personSchema.extend({
    yearsOfExperience: z.number().optional(),
  })
);
