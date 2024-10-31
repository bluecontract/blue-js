import {
  JsonArray,
  jsonArraySchema,
  JsonObject,
  jsonObjectSchema,
  JsonPrimitive,
} from './schema';

export const isJsonPrimitive = (value: unknown): value is JsonPrimitive => {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  );
};

export const isJsonObject = (value: unknown): value is JsonObject => {
  const jsonObjectParseResult = jsonObjectSchema.safeParse(value);
  return jsonObjectParseResult.success;
};

export const isJsonArray = (value: unknown): value is JsonArray => {
  const jsonArrayParseResult = jsonArraySchema.safeParse(value);
  return jsonArrayParseResult.success;
};
