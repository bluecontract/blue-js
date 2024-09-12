import { Contract } from '../schema';
import { getParticipantTimelineId } from './getParticipantTimelineId';
import { findParticipantListItem } from './findParticipantListItem';

export const findParticipantRole = ({
  participantTimeline,
  contract,
}: {
  participantTimeline: string;
  contract: Contract;
}) => {
  return findParticipantListItem(
    contract,
    (participant) =>
      getParticipantTimelineId(participant) === participantTimeline
  )?.participantRole;
};
