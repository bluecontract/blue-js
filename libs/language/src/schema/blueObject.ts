import { z, objectUtil } from 'zod';
import { blueIdSchema } from './blueId';
import {
  InferZodObjectCatchAll,
  InferZodObjectRawShape,
  InferZodObjectUnknownKeys,
} from '../types/zod';
import { SetRequired } from 'type-fest';

const baseBlueObjectSchema = z
  .object({
    value: z.union([z.string(), z.number(), z.boolean()]).optional().nullable(),
    blueId: blueIdSchema.optional(),
    name: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

type BaseBlueObjectInput = z.input<typeof baseBlueObjectSchema>;
type BaseBlueObjectOutput = z.infer<typeof baseBlueObjectSchema>;

type BaseBlueObjectRawShape = InferZodObjectRawShape<
  typeof baseBlueObjectSchema
>;
type BaseBlueObjectUnknownKeys = InferZodObjectUnknownKeys<
  typeof baseBlueObjectSchema
>;
type BaseBlueObjectCatchAll = InferZodObjectCatchAll<
  typeof baseBlueObjectSchema
>;

const baseBlueObjectLazyRawShape = {
  items: z.lazy(() => z.array(_blueObjectSchema).optional()),
  type: z.lazy(() => _blueObjectSchema.optional()),
};

type BlueObjectShape = objectUtil.extendShape<
  BaseBlueObjectRawShape,
  typeof baseBlueObjectLazyRawShape
>;

type BlueObjectInput = BaseBlueObjectInput & {
  items?: BlueObject[];
  type?: BlueObject;
};

export type BlueObject = BaseBlueObjectOutput & {
  items?: BlueObject[];
  type?: BlueObject;
};

export type BlueObjectWithId = SetRequired<BlueObject, 'blueId'>;

const _blueObjectSchema: z.ZodType<
  BlueObject,
  z.ZodObjectDef,
  BlueObjectInput
> = baseBlueObjectSchema.extend(baseBlueObjectLazyRawShape);

type BlueObjectZodObjectSchema = z.ZodObject<
  BlueObjectShape,
  BaseBlueObjectUnknownKeys,
  BaseBlueObjectCatchAll,
  BlueObject,
  BlueObjectInput
>;
/**
 * BlueObject schema
 * Doesn't have information about other attributes.
 * Those are BlueObject's so can be parsed separately.
 */
export const blueObjectSchema = _blueObjectSchema as BlueObjectZodObjectSchema;

export const blueObjectStringValueSchema = blueObjectSchema.extend({
  value: z.string().optional(),
});
