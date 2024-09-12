import { Contract, Participant } from '../schema';
import { processParticipants } from './utils/processParticipants';

export const findParticipantListItem = (
  contract: Contract,
  condition: (participant: Participant, participantRole: string) => boolean
): { participant: Participant; participantRole: string } | undefined => {
  const participants = contract.messaging?.participants;
  if (!participants) return undefined;

  let result: { participant: Participant; participantRole: string } | undefined;

  processParticipants(participants, (participant, participantRole) => {
    if (condition(participant, participantRole)) {
      result = { participant, participantRole };
      return true;
    }

    return false;
  });

  return result;
};
