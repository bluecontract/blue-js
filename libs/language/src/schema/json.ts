import { z } from 'zod';

const jsonPrimitives = [z.string(), z.number(), z.boolean(), z.null()] as const;
export const jsonPrimitiveSchema = z.union(jsonPrimitives);

export type JsonPrimitive = z.infer<typeof jsonPrimitiveSchema>;

export type JsonObject = { [Key in string]: JsonValue };

export type JsonArray = JsonValue[] | readonly JsonValue[];

/**
 * JSON value
 * Cannot be a function, a symbol, or undefined
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export const jsonObjectSchema: z.ZodType<JsonObject> = z.lazy(() =>
  z.record(jsonValueSchema)
);

export const jsonArraySchema: z.ZodType<JsonArray> = z.lazy(() =>
  z.union([z.array(jsonValueSchema), z.array(jsonValueSchema).readonly()])
);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, jsonObjectSchema, jsonArraySchema])
);
