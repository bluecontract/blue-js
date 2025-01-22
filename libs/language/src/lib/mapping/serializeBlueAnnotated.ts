import { ZodType, ZodObject, ZodTypeDef, AnyZodObject } from 'zod';
import {
  getBlueIdAnnotation,
  getBlueNameAnnotation,
  getBlueDescriptionAnnotation,
  getTypeBlueIdAnnotation,
} from './annotations';

type BlueSerialized = Record<string, unknown>;

export function serializeBlueAnnotated<T extends Record<string, unknown>>(
  value: T,
  schema: AnyZodObject | ZodType<T, ZodTypeDef, T>
): Record<string, unknown> {
  const typeBlueId = getTypeBlueIdAnnotation(schema);
  const result: BlueSerialized = {};

  if (typeBlueId && typeBlueId.value && typeBlueId.value[0]) {
    result.type = { blueId: typeBlueId.value[0] };
  }

  if (!(schema instanceof ZodObject)) {
    return {
      ...result,
      value,
    };
  }

  const shape = schema.shape;
  const processedFields = new Set<string>();

  const merges: Record<
    string,
    { name?: unknown; description?: unknown; value?: unknown; items?: unknown }
  > = {};

  for (const propName of Object.keys(shape)) {
    const fieldValue = value[propName];
    if (fieldValue === undefined) {
      continue;
    }

    const propSchema = shape[propName];
    const blueIdAnn = getBlueIdAnnotation(propSchema);
    const blueNameAnn = getBlueNameAnnotation(propSchema);
    const blueDescAnn = getBlueDescriptionAnnotation(propSchema);

    if (blueIdAnn) {
      result[propName] = { blueId: String(fieldValue) };
      processedFields.add(propName);
      continue;
    }

    if (blueNameAnn) {
      const targetFieldName = blueNameAnn;
      merges[targetFieldName] ||= {};
      merges[targetFieldName].name = fieldValue;

      const targetFieldValue = value[targetFieldName];
      if (Array.isArray(targetFieldValue) || targetFieldValue instanceof Set) {
        merges[targetFieldName].items = Array.isArray(targetFieldValue)
          ? targetFieldValue
          : Array.from(targetFieldValue);
      } else {
        merges[targetFieldName].value = targetFieldValue;
      }

      processedFields.add(propName);
      processedFields.add(targetFieldName);
      continue;
    }

    if (blueDescAnn) {
      const targetFieldName = blueDescAnn;
      merges[targetFieldName] ||= {};
      merges[targetFieldName].description = fieldValue;

      const targetFieldValue = value[targetFieldName];
      if (Array.isArray(targetFieldValue) || targetFieldValue instanceof Set) {
        merges[targetFieldName].items = Array.isArray(targetFieldValue)
          ? targetFieldValue
          : Array.from(targetFieldValue);
      } else {
        merges[targetFieldName].value = targetFieldValue;
      }

      processedFields.add(propName);
      processedFields.add(targetFieldName);
      continue;
    }
  }

  for (const [targetField, mergeObj] of Object.entries(merges)) {
    result[targetField] = {
      ...(mergeObj.name !== undefined ? { name: mergeObj.name } : {}),
      ...(mergeObj.description !== undefined
        ? { description: mergeObj.description }
        : {}),
      ...(mergeObj.items !== undefined
        ? { items: mergeObj.items }
        : mergeObj.value !== undefined
        ? { value: mergeObj.value }
        : {}),
    };
  }

  for (const propName of Object.keys(shape)) {
    if (processedFields.has(propName)) {
      continue;
    }

    const fieldValue = value[propName];
    result[propName] = fieldValue;
  }

  return result;
}
