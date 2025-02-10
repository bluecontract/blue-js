import z from 'zod';
import {
  blueIdField,
  blueNodeField,
  withTypeBlueId,
} from '../../../../schema/annotations';
import { personSchema } from './person';

export const personObjectExampleSchema = withTypeBlueId(
  'PersonObjectExample-BlueId'
)(
  z.object({
    alice1: blueIdField(),
    alice2: blueNodeField(),
    alice3: z.record(z.string(), z.unknown()).optional(),
    alice4: personSchema.optional(),
    alice5: personSchema.optional(),
  })
);
