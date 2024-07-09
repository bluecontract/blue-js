import { SetRequired } from 'type-fest';
import { BlueObject, BlueObjectWithId, blueObjectSchema } from './blueObject';
import { isNonNullable } from '@blue-company/shared-utils';

export const isBlueObject = (value: unknown): value is BlueObject => {
  const blueObjectParseResult = blueObjectSchema.safeParse(value);
  return blueObjectParseResult.success;
};

export const hasBlueObjectBlueIdDefined = (
  value?: BlueObject
): value is BlueObjectWithId => {
  return (
    isNonNullable(value) && 'blueId' in value && isNonNullable(value.blueId)
  );
};

export const hasBlueObjectNameDefined = (
  value?: BlueObject
): value is SetRequired<BlueObject, 'name'> => {
  return isNonNullable(value) && 'name' in value && isNonNullable(value.name);
};

export const hasBlueObjectItemsDefined = (
  value?: BlueObject
): value is SetRequired<BlueObject, 'items'> => {
  return isNonNullable(value) && 'items' in value && isNonNullable(value.items);
};

export const hasBlueObjectTypeDefined = (
  value?: BlueObject
): value is SetRequired<BlueObject, 'type'> => {
  return isNonNullable(value) && 'type' in value && isNonNullable(value.type);
};

export const hasBlueObjectValueDefined = (
  value?: BlueObject
): value is SetRequired<BlueObject, 'value'> => {
  return isNonNullable(value) && 'value' in value && isNonNullable(value.value);
};
