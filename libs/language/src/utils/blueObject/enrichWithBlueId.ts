import {
  BlueObject,
  BlueObjectWithId,
  hasBlueObjectBlueIdDefined,
} from '../../schema';
import { calculateBlueIdForJsonValue } from '../blueId';
import { JsonBlueValue } from '../../types';

export const enrichWithBlueId = async (object: BlueObject) => {
  if (hasBlueObjectBlueIdDefined(object)) {
    return object;
  }

  // const jsonValue = jsonSchema.parse(object);
  const blueId = await calculateBlueIdForJsonValue(object as JsonBlueValue);

  return {
    ...object,
    blueId,
  } satisfies BlueObjectWithId;
};
