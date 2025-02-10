import z from 'zod';
import { withTypeBlueId } from '../../../../schema/annotations';
import { personSchema } from './person';

export const personDictionaryExampleSchema = withTypeBlueId(
  'PersonDictionary-BlueId'
)(
  z.object({
    team1: z.map(z.string(), personSchema),
    team2: z.map(z.string(), personSchema),
    team3: z.map(z.number(), personSchema),
  })
);
