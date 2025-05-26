import {
  ZodRawShape,
  objectOutputType,
  objectInputType,
  UnknownKeysParam,
  ZodTypeAny,
  ZodObject,
} from 'zod';
import { BlueNode } from '../model';
import { BlueIdResolver } from './BlueIdResolver';
import { isNullable } from '@blue-company/shared-utils';

export class BlueNodeTypeSchema {
  static isTypeOf<
    T extends ZodRawShape,
    UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
    Catchall extends ZodTypeAny = ZodTypeAny,
    Output = objectOutputType<T, Catchall, UnknownKeys>,
    Input = objectInputType<T, Catchall, UnknownKeys>
  >(
    node: BlueNode,
    schema: ZodObject<T, UnknownKeys, Catchall, Output, Input>
  ): boolean {
    const schemaBlueId = BlueIdResolver.resolveBlueId(schema);
    const nodeTypeBlueId = node.getType()?.getBlueId();

    if (isNullable(schemaBlueId) || isNullable(nodeTypeBlueId)) {
      return false;
    }

    return schemaBlueId === nodeTypeBlueId;
  }
}
