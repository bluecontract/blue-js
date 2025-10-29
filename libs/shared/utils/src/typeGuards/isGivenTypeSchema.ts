import { z } from 'zod';

export const isGivenTypeSchema = <
  Output = unknown,
  Def extends z.ZodTypeDef = z.ZodTypeDef,
  Input = Output,
>(
  schema: z.ZodType<Output, Def, Input>,
  value: unknown,
): value is Output => {
  return schema.safeParse(value).success;
};
