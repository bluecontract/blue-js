import { isPrimitive as isPrimitiveRadash } from 'radash';
import { JsonBluePrimitive } from '../../types';

export const isJsonBluePrimitive = (
  value: unknown
): value is JsonBluePrimitive =>
  isPrimitiveRadash(value) && value !== undefined;
