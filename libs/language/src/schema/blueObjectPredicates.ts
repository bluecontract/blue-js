import { SetRequired } from 'type-fest';
import { blueObjectSchema, BlueObject, BlueObjectWithId } from './generated';
import { isNonNullable } from '@blue-labs/shared-utils';
import {
  objectInputType,
  objectOutputType,
  UnknownKeysParam,
  z,
  ZodRawShape,
  ZodTypeAny,
} from 'zod';

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

export const isGivenBlueObjectTypeSchema = <
  T extends ZodRawShape,
  UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
  Catchall extends ZodTypeAny = ZodTypeAny,
  Output = objectOutputType<T, Catchall, UnknownKeys>,
  Input = objectInputType<T, Catchall, UnknownKeys>
>(
  schema: z.ZodObject<T, UnknownKeys, Catchall, Output, Input>,
  value: unknown
): value is Output => {
  return (schema as z.AnyZodObject).required({ type: true }).safeParse(value)
    .success;
};
