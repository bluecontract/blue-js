import { ZodType, ZodTypeAny, ZodTypeDef } from 'zod';

// Singleton pattern to ensure schemaAnnotations is only created once
const SCHEMA_ANNOTATIONS_KEY = Symbol.for('zod-schema-annotations');

function getGlobalObject() {
  // Modern standard - works in Node.js 12+ and modern browsers
  if (typeof globalThis !== 'undefined') return globalThis;

  // Node.js fallback
  if (typeof global !== 'undefined') return global;

  // Browser fallback
  // @ts-expect-error - window is not defined in the browser
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== 'undefined') return window as any;

  // Web worker fallback
  // @ts-expect-error - self is not defined in the browser
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof self !== 'undefined') return self as any;

  throw new Error('Unable to locate global object');
}

function getGlobalSchemaAnnotations(): WeakMap<
  ZodTypeAny,
  Record<string, unknown>
> {
  const globalObj = getGlobalObject();

  if (!(SCHEMA_ANNOTATIONS_KEY in globalObj)) {
    globalObj[SCHEMA_ANNOTATIONS_KEY] = new WeakMap<
      ZodTypeAny,
      Record<string, unknown>
    >();
  }
  return globalObj[SCHEMA_ANNOTATIONS_KEY];
}

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
  Schema extends ZodType<Output, Def, Input> = ZodType<Output, Def, Input>,
>(schema: Schema, annotations: Record<string, unknown>): Schema {
  const annotationsMap = getGlobalSchemaAnnotations();
  const existing = annotationsMap.get(schema) || {};
  annotationsMap.set(schema, { ...existing, ...annotations });

  return schema;
}

export const getAnnotations = (schema: ZodTypeAny) => {
  return getGlobalSchemaAnnotations().get(schema);
};
