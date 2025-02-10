import { isNonNullable } from '@blue-company/shared-utils';
import { isString } from 'radash';
import { z, ZodTypeAny } from 'zod';
import { setAnnotations, getAnnotations } from './annotations';

export const withBlueDescription =
  (value: string) =>
  <Schema extends ZodTypeAny = ZodTypeAny>(schema: Schema) => {
    const annotations = getAnnotations(schema);

    return setAnnotations(schema, {
      ...annotations,
      blueDescription: value,
    });
  };

export const getBlueDescriptionAnnotation = (schema: ZodTypeAny) => {
  const annotations = getAnnotations(schema);
  if (isNonNullable(annotations) && isString(annotations.blueDescription)) {
    return annotations.blueDescription;
  }
  return null;
};

export const blueDescriptionField = (fieldName: string) =>
  withBlueDescription(fieldName)(z.string().optional());
