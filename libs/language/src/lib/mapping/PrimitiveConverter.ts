import {
  ZodBoolean,
  ZodBigInt,
  ZodNumber,
  ZodString,
  ZodEnum,
  ZodNativeEnum,
} from 'zod';
import { BlueNode } from '../model';
import { Converter } from './Converter';
import { ValueConverter } from './ValueConverter';

export class PrimitiveConverter implements Converter {
  convert(
    node: BlueNode,
    targetType:
      | ZodString
      | ZodNumber
      | ZodBoolean
      | ZodBigInt
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | ZodEnum<any>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | ZodNativeEnum<any>,
  ) {
    return ValueConverter.convertValue(node, targetType);
  }
}
