import { ZodType, ZodTypeAny, ZodTypeDef } from 'zod';

const schemaAnnotations = new WeakMap<ZodTypeAny, Record<string, unknown>>();

/**
 * A helper to define annotations on a Zod schema.
 * @param schema Any Zod type
 * @param annotations   Annotations to define
 * @returns      The same schema as input
 */
export function setAnnotations<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Output = any,
  Def extends ZodTypeDef = ZodTypeDef,
  Input = Output,
  Schema extends ZodType<Output, Def, Input> = ZodType<Output, Def, Input>
>(schema: Schema, annotations: Record<string, unknown>): Schema {
  const existing = schemaAnnotations.get(schema) || {};
  schemaAnnotations.set(schema, { ...existing, ...annotations });

  return schema;
}

export const getAnnotations = (schema: ZodTypeAny) => {
  return schemaAnnotations.get(schema);
};
