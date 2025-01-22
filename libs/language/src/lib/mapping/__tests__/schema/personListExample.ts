import z from 'zod';
import {
  blueDescriptionField,
  blueNameField,
  blueNodeField,
  withTypeBlueId,
} from '../../annotations';
import { personSchema } from './person';

export const personListExampleSchema = withTypeBlueId('PersonList-BlueId')(
  z.object({
    team1: z.array(personSchema),
    team2Name: blueNameField('team2'),
    team2Description: blueDescriptionField('team2'),
    team2: z.array(personSchema),
    team3: blueNodeField(),
  })
);
