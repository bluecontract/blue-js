import {
  BlueObject,
  BlueObjectWithId,
  hasBlueObjectBlueIdDefined,
} from '../../schema';
import { calculateBlueId } from '../blueId';

export const enrichWithBlueId = async (object: BlueObject) => {
  if (hasBlueObjectBlueIdDefined(object)) {
    return object;
  }

  const blueId = await calculateBlueId(object);

  return {
    ...object,
    blueId,
  } satisfies BlueObjectWithId;
};
