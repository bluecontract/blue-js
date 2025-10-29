import {
  objectInputType,
  objectOutputType,
  UnknownKeysParam,
  z,
  ZodObject,
  ZodRawShape,
  ZodTypeAny,
} from 'zod';
import { getAnnotations, setAnnotations } from '../annotations';
import { proxySchema } from './proxySchema';

const typeBlueIdAnnotation = z.object({
  value: z.array(z.string()).optional(),
  defaultValue: z.string().optional(),
});

type TypeBlueIdAnnotation = z.infer<typeof typeBlueIdAnnotation>;

export const getTypeBlueIdAnnotation = (schema: ZodTypeAny) => {
  const annotations = getAnnotations(schema);
  const result = typeBlueIdAnnotation
    .passthrough()
    .safeParse(annotations?.typeBlueId);
  if (!result.success) {
    return null;
  }

  return result.data;
};

export const withTypeBlueId =
  (value: string | TypeBlueIdAnnotation) =>
  <
    T extends ZodRawShape,
    UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
    Catchall extends ZodTypeAny = ZodTypeAny,
    Output = objectOutputType<T, Catchall, UnknownKeys>,
    Input = objectInputType<T, Catchall, UnknownKeys>,
  >(
    schema: ZodObject<T, UnknownKeys, Catchall, Output, Input>,
  ) => {
    const annotations = getAnnotations(schema);
    const typeBlueIdAnnotation = (
      typeof value === 'string' ? { value: [value] } : value
    ) satisfies TypeBlueIdAnnotation;
    const proxiedSchema = proxySchema(schema);

    return setAnnotations(proxiedSchema, {
      ...annotations,
      typeBlueId: {
        ...(annotations?.typeBlueId || {}),
        ...typeBlueIdAnnotation,
      },
    });
  };
