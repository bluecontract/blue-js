import { ZodTypeAny } from 'zod';
import { BlueNode } from '../model';

export interface Converter {
  convert(node: BlueNode, targetType: ZodTypeAny): unknown;
}
