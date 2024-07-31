import { getBlueObjectProperties } from '@blue-company/language';
import { Contract } from './schema';

export const getParticipantsRoles = (
  participants: Contract['participants']
) => {
  const properties = getBlueObjectProperties(participants);

  return Object.keys(properties);
};
