import { blueObjectSchema } from '@blue-company/language';
import { z } from 'zod';
import { participantSchema } from './participant';
import { actionSchema } from './actions/action';

export const eventSchema = blueObjectSchema;

export const actionByParticipantEventSchema = eventSchema
  .extend({
    type: blueObjectSchema.extend({
      name: z.literal('Action by Participant').optional(),
    }),
    participant: participantSchema,
    action: z.lazy(() => actionSchema),
  })
  .strip();

export type ActionByParticipantEvent = z.infer<
  typeof actionByParticipantEventSchema
>;
