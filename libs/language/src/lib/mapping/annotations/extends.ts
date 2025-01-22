import { isNonNullable, isNullable } from '@blue-company/shared-utils';
import { AnyZodObject, ZodType, ZodTypeAny } from 'zod';
import { setAnnotations, getAnnotations } from './annotations';

const key = 'extendedFrom';

export const withExtendedFromSchema = <
  Schema extends AnyZodObject = AnyZodObject,
  BaseSchema extends ZodTypeAny = ZodTypeAny
>({
  schema,
  baseSchema,
}: {
  schema: Schema;
  baseSchema: BaseSchema;
}) => {
  const currentAnnotations = getAnnotations(schema) || {};

  return setAnnotations(schema, {
    ...currentAnnotations,
    [key]: baseSchema,
  });
};

export const getExtendedFromSchemaAnnotation = (schema: ZodTypeAny) => {
  const annotations = getAnnotations(schema);
  if (isNonNullable(annotations) && annotations[key]) {
    return annotations[key] as ZodTypeAny;
  }

  return null;
};

export const isSchemaExtendedFrom = (
  schema: ZodType,
  baseSchema: ZodType
): boolean => {
  const extendedFrom = getExtendedFromSchemaAnnotation(schema);

  if (isNullable(extendedFrom)) {
    return false;
  }

  if (extendedFrom?._def === baseSchema?._def) {
    return true;
  }

  return isSchemaExtendedFrom(extendedFrom, baseSchema);
};
