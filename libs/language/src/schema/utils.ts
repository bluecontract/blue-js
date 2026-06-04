import {
  ZodTypeAny,
  ZodEffects,
  ZodLazy,
  ZodBranded,
  ZodReadonly,
  ZodNullable,
  ZodOptional,
  ZodBigInt,
  ZodBoolean,
  ZodNumber,
  ZodString,
} from 'zod';

export const isWrapperType = (
  schema: ZodTypeAny,
): schema is
  | ZodOptional<ZodTypeAny>
  | ZodNullable<ZodTypeAny>
  | ZodReadonly<ZodTypeAny>
  | ZodBranded<ZodTypeAny, never>
  | ZodEffects<ZodTypeAny>
  | ZodLazy<ZodTypeAny> => {
  const typeName = String(schema._def.typeName);
  return (
    typeName === 'ZodOptional' ||
    typeName === 'ZodNullable' ||
    typeName === 'ZodReadonly' ||
    typeName === 'ZodBranded' ||
    typeName === 'ZodEffects' ||
    typeName === 'ZodLazy'
  );
};

export const isPrimitiveType = (
  schema: ZodTypeAny,
): schema is ZodString | ZodNumber | ZodBoolean | ZodBigInt => {
  const typeName = String(schema._def.typeName);
  return (
    typeName === 'ZodString' ||
    typeName === 'ZodNumber' ||
    typeName === 'ZodBoolean' ||
    typeName === 'ZodBigInt'
  );
};
