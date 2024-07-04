import { z } from 'zod';
import { JsonPrimitive, JsonArray, JsonObject, JsonValue } from 'type-fest';

export { type JsonPrimitive, type JsonValue, type JsonObject, type JsonArray };

const jsonPrimitives = [z.string(), z.number(), z.boolean(), z.null()] as const;

export const jsonPrimitiveSchema = z.union(jsonPrimitives);

export const jsonObjectSchema: z.ZodType<JsonObject> = z.lazy(() =>
  z.intersection(
    z.record(jsonValueSchema),
    z.record(jsonValueSchema).optional()
  )
);

export const jsonArraySchema: z.ZodType<JsonArray> = z.lazy(() =>
  z.union([z.array(jsonValueSchema), z.array(jsonValueSchema).readonly()])
);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, jsonObjectSchema, jsonArraySchema])
);
