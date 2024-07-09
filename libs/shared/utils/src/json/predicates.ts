import { JsonPrimitive, jsonPrimitiveSchema } from './schema';

export const isJsonPrimitive = (value: unknown): value is JsonPrimitive => {
  const jsonPrimitiveParseResult = jsonPrimitiveSchema.safeParse(value);
  return jsonPrimitiveParseResult.success;
};
