import { z, ZodTypeAny } from 'zod';
import { getAnnotations, setAnnotations } from './annotations';

const blueIdAnnotation = z.union([z.string(), z.boolean()]);

export const withBlueId =
  (value: string | boolean) =>
  <Schema extends ZodTypeAny = ZodTypeAny>(schema: Schema) => {
    const annotations = getAnnotations(schema);

    return setAnnotations(schema, {
      ...annotations,
      blueId: value,
    });
  };

export const getBlueIdAnnotation = (schema: ZodTypeAny) => {
  const annotations = getAnnotations(schema);
  const result = blueIdAnnotation.safeParse(annotations?.blueId);
  if (result.success) {
    return result.data;
  }
  return null;
};

export const blueIdField = (fieldName?: string) =>
  withBlueId(fieldName ?? true)(z.string());
