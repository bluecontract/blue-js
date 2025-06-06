import z from 'zod';
import { withTypeBlueId } from '@blue-company/schema-annotations';
import { personSchema } from './person';

export const doctorSchema = withTypeBlueId('Doctor-BlueId')(
  personSchema.extend({
    specialization: z.string(),
  })
);
