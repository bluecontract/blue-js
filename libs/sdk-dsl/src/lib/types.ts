import type { BlueNode } from '@blue-labs/language';
import type { ZodTypeAny } from 'zod';

export interface BlueIdLike {
  blueId: string;
}

export type TypeInput = string | BlueIdLike | BlueNode | ZodTypeAny;

export type BlueValue =
  | null
  | string
  | number
  | boolean
  | BlueNode
  | BlueIdLike
  | BlueValue[]
  | { [key: string]: BlueValue };
