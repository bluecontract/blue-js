import {
  BlueObject,
  BlueObjectWithId,
  hasBlueObjectBlueIdDefined,
  jsonBlueValueSchema,
} from '../../schema';
import { calculateBlueId } from '../blueId';

export const enrichWithBlueId = async (object: BlueObject) => {
  if (hasBlueObjectBlueIdDefined(object)) {
    return object;
  }

  try {
    const jsonBlueValue = jsonBlueValueSchema.parse(object);
    const blueId = await calculateBlueId(jsonBlueValue);

    return {
      ...object,
      blueId,
    } satisfies BlueObjectWithId;
  } catch (error) {
    throw new Error(`Failed enriching object with Blue ID: ${error}`);
  }
};
