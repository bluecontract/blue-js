// Generated by ts-to-zod
import { z } from 'zod';
import { BlueObject } from './blueObject';

export const blueObjectSchema: z.ZodSchema<BlueObject> = z.lazy(() =>
  z.record(z.unknown()).and(
    z.object({
      blueId: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      type: blueObjectSchema.optional(),
      value: z
        .union([z.string(), z.number(), z.boolean()])
        .optional()
        .nullable(),
      items: z.array(blueObjectSchema).optional(),
    }),
  ),
);

export const baseBlueObjectSchema = z.object({
  blueId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  type: blueObjectSchema.optional(),
});

export const blueObjectStringValueSchema = baseBlueObjectSchema.extend({
  value: z.string().optional(),
});

export const blueObjectBooleanValueSchema = baseBlueObjectSchema.extend({
  value: z.boolean().optional(),
});

export const blueObjectStringListItemsSchema = baseBlueObjectSchema.extend({
  items: z.array(z.string()).optional(),
});
