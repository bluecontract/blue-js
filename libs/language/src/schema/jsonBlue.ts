import { z } from 'zod';
import { default as Big } from 'big.js';
import { JsonPrimitive, jsonPrimitiveSchema } from './json';

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
