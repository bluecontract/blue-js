import { Contract, Participant } from '../schema';
import { findParticipantListItem } from './findParticipantListItem';

export const findParticipant = (
  contract: Contract,
  condition: (participant: Participant, participantRole: string) => boolean
) => {
  return findParticipantListItem(contract, condition)?.participant;
};
