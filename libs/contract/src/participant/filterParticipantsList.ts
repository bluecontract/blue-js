import { Contract, Participant } from '../schema';
import { processParticipants } from './utils/processParticipants';

export const filterParticipantsList = (
  contract: Contract,
  condition: (participant: Participant, participantRole: string) => boolean
): { participant: Participant; participantRole: string }[] => {
  const participants = contract.messaging?.participants;
  if (!participants) return [];

  const result: { participant: Participant; participantRole: string }[] = [];

  processParticipants(participants, (participant, participantRole) => {
    if (condition(participant, participantRole)) {
      result.push({ participant, participantRole });
    }
  });

  return result;
};
