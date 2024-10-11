import {
  JsonArray,
  jsonArraySchema,
  JsonObject,
  jsonObjectSchema,
  JsonPrimitive,
  jsonPrimitiveSchema,
} from './schema';

export const isJsonPrimitive = (value: unknown): value is JsonPrimitive => {
  const jsonPrimitiveParseResult = jsonPrimitiveSchema.safeParse(value);
  return jsonPrimitiveParseResult.success;
};

export const isJsonObject = (value: unknown): value is JsonObject => {
  const jsonObjectParseResult = jsonObjectSchema.safeParse(value);
  return jsonObjectParseResult.success;
};

export const isJsonArray = (value: unknown): value is JsonArray => {
  const jsonArrayParseResult = jsonArraySchema.safeParse(value);
  return jsonArrayParseResult.success;
};
