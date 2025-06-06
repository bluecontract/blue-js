import { isNonNullable } from '@blue-company/shared-utils';
import { isString } from 'radash';
import { z, ZodTypeAny } from 'zod';
import { setAnnotations, getAnnotations } from './annotations';

export const withBlueName =
  (value: string) =>
  <Schema extends ZodTypeAny = ZodTypeAny>(schema: Schema) => {
    const annotations = getAnnotations(schema);

    return setAnnotations(schema, {
      ...annotations,
      blueName: value,
    });
  };

export const getBlueNameAnnotation = (schema: ZodTypeAny) => {
  const annotations = getAnnotations(schema);
  if (isNonNullable(annotations) && isString(annotations.blueName)) {
    return annotations.blueName;
  }
  return null;
};

export const blueNameField = (fieldName: string) => {
  const blueNameFieldSchema = z.string().optional();
  return withBlueName(fieldName)(blueNameFieldSchema);
};
