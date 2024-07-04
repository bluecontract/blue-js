import { omit } from 'radash';
import { BlueObject } from '../../schema';
import { isNonNullable } from '../typeGuards';

export const isBlueObjectResolved = (value?: BlueObject): boolean => {
  return (
    isNonNullable(value) && Object.keys(omit(value, ['blueId'])).length > 0
  );
};
