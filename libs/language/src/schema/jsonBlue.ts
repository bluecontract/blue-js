import { z } from 'zod';
import { default as Big } from 'big.js';
import {
  isReadonlyArray,
  JsonPrimitive,
  jsonPrimitiveSchema,
  isJsonPrimitive,
} from '@blue-company/shared-utils';
import { isArray, isObject } from 'radash';
import { isBigNumber } from '../utils/typeGuards';

export type JsonBlueObject = { [Key in string]: JsonBlueValue };

export type JsonBlueArray = JsonBlueValue[] | readonly JsonBlueValue[];

/**
 * JSON Blue value.
 * Cannot be a function, a symbol, or undefined.
 * Additional to basic JSON value, it can be a Big.js instance to represent a number with arbitrary precision.
 */
export type JsonBlueValue =
  | JsonPrimitive
  | JsonBlueObject
  | JsonBlueArray
  | Big;

const jsonBlueObjectSchema: z.ZodType<JsonBlueObject> = z.lazy(() =>
  z.record(jsonBlueValueSchema)
);

const jsonBlueArraySchema: z.ZodType<JsonBlueArray> = z.lazy(() =>
  z.union([
    z.array(jsonBlueValueSchema),
    z.array(jsonBlueValueSchema).readonly(),
  ])
);

export const jsonBlueValueSchema: z.ZodType<JsonBlueValue> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    jsonBlueObjectSchema,
    jsonBlueArraySchema,
    z.instanceof(Big),
  ])
);

export const isJsonBlueObject = (value: unknown): value is JsonBlueObject => {
  return (
    isObject(value) &&
    !isArray(value) &&
    !isReadonlyArray(value) &&
    !isBigNumber(value)
  );
};

export const isJsonBlueArray = (value: unknown): value is JsonBlueArray => {
  return isArray(value) || isReadonlyArray(value);
};

export const isJsonBlueValue = (value: unknown): value is JsonBlueValue => {
  return (
    isJsonBlueArray(value) ||
    isJsonBlueObject(value) ||
    isBigNumber(value) ||
    isJsonPrimitive(value)
  );
};
