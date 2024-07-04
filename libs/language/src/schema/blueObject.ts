import { z, objectUtil } from 'zod';
import { blueIdSchema } from './blueId';
import {
  InferZodObjectCatchAll,
  InferZodObjectRawShape,
  InferZodObjectUnknownKeys,
} from '../types/zod';
import { SetRequired } from 'type-fest';

const literal = [z.string(), z.number(), z.boolean(), z.null()] as const;

const baseBlueObjectSchema = z
  .object({
    blueId: blueIdSchema.optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    value: z.union(literal).optional(),
  })
  .passthrough();

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

type BlueObjectInput = z.input<typeof baseBlueObjectSchema> & {
  items?: BlueObject[];
  type?: BlueObject;
};

export type BlueObject = z.output<typeof baseBlueObjectSchema> & {
  items?: BlueObject[];
  type?: BlueObject;
};

export type BlueObjectWithId = SetRequired<BlueObject, 'blueId'>;

/**
 * BlueObject schema
 * Doesn't have information about other attributes.
 * Those are BlueObject's so can be parsed separately.
 */
const _blueObjectSchema: z.ZodType<
  BlueObject,
  z.ZodObjectDef,
  BlueObjectInput
> = baseBlueObjectSchema.extend(baseBlueObjectLazyRawShape);

export const blueObjectSchema = _blueObjectSchema as z.ZodObject<
  BlueObjectShape,
  BaseBlueObjectUnknownKeys,
  BaseBlueObjectCatchAll,
  BlueObject,
  BlueObjectInput
>;
