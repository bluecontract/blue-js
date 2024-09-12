export const getParticipantTimelineId = <
  TParticipant extends { timeline?: { blueId?: string; value?: string } }
>(
  participant?: TParticipant
) => participant?.timeline?.blueId ?? participant?.timeline?.value;
