import { z } from 'zod';
import { default as Big } from 'big.js';
import { JsonPrimitive, jsonPrimitiveSchema } from './json';

export type JsonBlueObject = { [Key in string]: JsonBlueValue };

export type JsonBlueArray = JsonBlueValue[] | readonly JsonBlueValue[];

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
