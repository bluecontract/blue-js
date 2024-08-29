import { getBlueObjectProperties } from '@blue-company/language';
import { BlueObject } from './schema';

export const getParticipantsRoles = (participants?: BlueObject) => {
  const properties = getBlueObjectProperties(participants);

  return Object.keys(properties);
};
