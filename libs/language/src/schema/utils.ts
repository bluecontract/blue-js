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
  schema: ZodTypeAny
): schema is
  | ZodOptional<ZodTypeAny>
  | ZodNullable<ZodTypeAny>
  | ZodReadonly<ZodTypeAny>
  | ZodBranded<ZodTypeAny, never>
  | ZodEffects<ZodTypeAny>
  | ZodLazy<ZodTypeAny> => {
  return (
    schema instanceof ZodOptional ||
    schema instanceof ZodNullable ||
    schema instanceof ZodReadonly ||
    schema instanceof ZodBranded ||
    schema instanceof ZodEffects ||
    schema instanceof ZodLazy
  );
};

export const isPrimitiveType = (
  schema: ZodTypeAny
): schema is ZodString | ZodNumber | ZodBoolean | ZodBigInt => {
  return (
    schema instanceof ZodString ||
    schema instanceof ZodNumber ||
    schema instanceof ZodBoolean ||
    schema instanceof ZodBigInt
  );
};
