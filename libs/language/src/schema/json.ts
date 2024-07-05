import { z } from 'zod';
import { type JsonArray, type JsonObject, type JsonValue } from 'type-fest';
export {
  type JsonPrimitive,
  type JsonArray,
  type JsonObject,
  type JsonValue,
} from 'type-fest';

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
