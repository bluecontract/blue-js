import { z } from 'zod';

export function reference<T>(schema: z.ZodType<T>): z.ZodType<T> {
  return schema;
}
