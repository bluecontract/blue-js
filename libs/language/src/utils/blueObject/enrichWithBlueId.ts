import {
  BlueObject,
  BlueObjectWithId,
  hasBlueObjectBlueIdDefined,
} from '../../schema';
import { calculateBlueIdForJsonValue } from '../blueId';
import { jsonBlueValueSchema } from '../../schema';

export const enrichWithBlueId = async (object: BlueObject) => {
  if (hasBlueObjectBlueIdDefined(object)) {
    return object;
  }

  const jsonValue = jsonBlueValueSchema.parse(object);
  const blueId = await calculateBlueIdForJsonValue(jsonValue);

  return {
    ...object,
    blueId,
  } satisfies BlueObjectWithId;
};
