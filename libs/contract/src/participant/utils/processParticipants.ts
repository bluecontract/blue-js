import { BlueObject } from '@blue-labs/language';
import {
  Participant,
  participantObjectListSchema,
  participantSchema,
} from '../../schema';
import { isGivenTypeSchema, isNonNullable } from '@blue-labs/shared-utils';
import { getParticipantsRoles } from '../getParticipantsRoles';

/**
 * Processes participants in a contract, applying a callback function to each participant.
 *
 * @param {BlueObject} participants - An object containing participant data.
 * @param {Function} callback - A function to be called for each participant.
 *   @param {Participant} callback.participant - The current participant being processed.
 *   @param {string} callback.participantRole - The role of the current participant.
 *   @returns {boolean|void} callback return - If the callback returns true, processing stops.
 *
 * @example
 * const participants = {
 *   buyer: { name: "John Doe" },
 *   sellers: { items: [{ name: "Jane Doe" }, { name: "Bob Smith" }] }
 * };
 *
 * processParticipants(participants, (participant, role) => {
 *   console.log(`${role}: ${participant.name}`);
 * });
 */
export const processParticipants = (
  participants: BlueObject,
  callback: (
    participant: Participant,
    participantRole: string
  ) => boolean | void
): void => {
  const roles = getParticipantsRoles(participants);

  for (const participantRole of roles) {
    const participantRoleObject = participants[participantRole];

    if (
      isGivenTypeSchema(participantObjectListSchema, participantRoleObject) &&
      isNonNullable(participantRoleObject.items)
    ) {
      for (const participant of participantRoleObject.items) {
        if (callback(participant, participantRole) === true) return;
      }
    } else if (isGivenTypeSchema(participantSchema, participantRoleObject)) {
      if (callback(participantRoleObject, participantRole) === true) return;
    }
  }
};
