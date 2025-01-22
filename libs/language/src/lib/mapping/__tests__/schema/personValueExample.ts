import { z } from 'zod';
import {
  blueDescriptionField,
  blueNameField,
  withTypeBlueId,
  blueNodeField,
} from '../../annotations';

export const personValueExampleSchema = withTypeBlueId('PersonValue-BlueId')(
  z.object({
    age1: z.number().optional(),
    age2Name: blueNameField('age2'),
    age2Description: blueDescriptionField('age2'),
    age2: z.number().optional(),
    age3Name: blueNameField('age3'),
    age3: blueNodeField().optional(),
  })
);

export type PersonValueExample = z.infer<typeof personValueExampleSchema>;
