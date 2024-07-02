/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from 'zod';

export type InferZodObjectRawShape<T> = T extends z.ZodObject<infer Shape>
  ? Shape
  : never;
export type InferZodObjectUnknownKeys<T> = T extends z.ZodObject<
  any,
  infer UnknownKeys
>
  ? UnknownKeys
  : never;
export type InferZodObjectCatchAll<T> = T extends z.ZodObject<
  any,
  any,
  infer CatchAll
>
  ? CatchAll
  : never;
