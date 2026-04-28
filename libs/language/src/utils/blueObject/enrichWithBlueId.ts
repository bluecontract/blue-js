import {
  BlueObject,
  BlueObjectWithId,
  hasBlueObjectBlueIdDefined,
  jsonBlueValueSchema,
} from '../../schema';

export const enrichWithBlueId = async (object: BlueObject) => {
  if (hasBlueObjectBlueIdDefined(object)) {
    return object;
  }

  try {
    const jsonBlueValue = jsonBlueValueSchema.parse(object);
    const { Blue } = await import('../../lib/Blue.js');
    const blueId = await new Blue().calculateBlueId(jsonBlueValue);

    return {
      ...object,
      blueId,
    } satisfies BlueObjectWithId;
  } catch (error) {
    throw new Error(`Failed enriching object with Blue ID: ${error}`);
  }
};
