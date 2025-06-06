import { getBlueObjectProperties, BlueObject } from '@blue-labs/language';

export const getParticipantsRoles = (participants?: BlueObject) => {
  const properties = getBlueObjectProperties(participants);

  return Object.keys(properties);
};
