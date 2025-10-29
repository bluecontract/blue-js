import {
  objectInputType,
  objectOutputType,
  UnknownKeysParam,
  ZodObject,
  ZodRawShape,
  ZodTypeAny,
} from 'zod';
import { withExtendedFromSchema } from '../extends';

export const proxySchema = <
  T extends ZodRawShape,
  UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
  Catchall extends ZodTypeAny = ZodTypeAny,
  Output = objectOutputType<T, Catchall, UnknownKeys>,
  Input = objectInputType<T, Catchall, UnknownKeys>,
>(
  schema: ZodObject<T, UnknownKeys, Catchall, Output, Input>,
) => {
  return new Proxy(schema, {
    get(target, prop, receiver) {
      if (prop === 'extend') {
        return function (
          ...args: Parameters<typeof ZodObject.prototype.extend>
        ) {
          const extendedSchema = target.extend(...args);

          return withExtendedFromSchema({
            schema: extendedSchema,
            baseSchema: target,
          });
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });
};
