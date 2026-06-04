import { ZodTypeAny } from 'zod';
import { BigDecimalNumber, BigIntegerNumber, BlueNode } from '../model';
import {
  TEXT_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
} from '../utils/Properties';
import { isNullable } from '@blue-labs/shared-utils';
import { isPrimitiveType } from '../../schema/utils';
import { Nodes } from '../utils/Nodes';

export class ValueConverter {
  static convertValue(node: BlueNode, targetSchema: ZodTypeAny) {
    const typeBlueId = node.getType()?.getBlueId();
    const value = node.getValue();
    if (isNullable(value)) {
      if (isPrimitiveType(targetSchema) && Nodes.isValidValueNode(node)) {
        return this.getDefaultPrimitiveValue(targetSchema);
      }
      return value;
    }

    if (TEXT_TYPE_BLUE_ID === typeBlueId) {
      return this.convertFromString(String(value), targetSchema);
    } else if (
      DOUBLE_TYPE_BLUE_ID === typeBlueId ||
      value instanceof BigDecimalNumber
    ) {
      return this.convertFromBigDecimal(
        new BigDecimalNumber(value?.toString()),
        targetSchema,
      );
    } else if (
      INTEGER_TYPE_BLUE_ID === typeBlueId ||
      value instanceof BigIntegerNumber
    ) {
      return this.convertFromBigInteger(
        new BigIntegerNumber(value?.toString()),
        targetSchema,
      );
    } else if (
      BOOLEAN_TYPE_BLUE_ID === typeBlueId ||
      typeof value === 'boolean'
    ) {
      return this.convertFromBoolean(Boolean(value), targetSchema);
    }

    return this.convertFromString(String(value), targetSchema);
  }

  private static convertFromString(value: string, targetSchema: ZodTypeAny) {
    if (!targetSchema) return value;

    const targetTypeName = zodTypeName(targetSchema);

    if (
      targetTypeName === 'ZodString' ||
      targetTypeName === 'ZodEnum' ||
      targetTypeName === 'ZodNativeEnum'
    ) {
      return value;
    }

    if (targetTypeName === 'ZodNumber') {
      return Number(value);
    }

    if (targetTypeName === 'ZodBoolean') {
      return value.toLowerCase() === 'true';
    }

    if (targetTypeName === 'ZodBigInt') {
      return BigInt(value);
    }

    throw new Error(`Cannot convert String to ${targetSchema._def.typeName}`);
  }

  private static convertFromBigDecimal(
    value: BigDecimalNumber,
    targetSchema: ZodTypeAny,
  ) {
    const targetTypeName = zodTypeName(targetSchema);

    if (targetTypeName === 'ZodNumber') {
      return value.toNumber();
    }

    if (targetTypeName === 'ZodString') {
      return value.toString();
    }

    throw new Error(`Cannot convert Number to ${targetSchema._def.typeName}`);
  }

  private static convertFromBigInteger(
    value: BigIntegerNumber,
    targetSchema: ZodTypeAny,
  ) {
    const targetTypeName = zodTypeName(targetSchema);

    if (targetTypeName === 'ZodNumber') {
      return value.toNumber();
    }

    if (targetTypeName === 'ZodBigInt') {
      return BigInt(value.toString());
    }

    if (targetTypeName === 'ZodString') {
      return value.toString();
    }

    throw new Error(`Cannot convert Number to ${targetSchema._def.typeName}`);
  }

  private static convertFromBoolean(value: boolean, targetSchema: ZodTypeAny) {
    if (!targetSchema) return value;

    const targetTypeName = zodTypeName(targetSchema);

    if (targetTypeName === 'ZodBoolean') {
      return value;
    }

    if (targetTypeName === 'ZodString') {
      return value.toString();
    }

    if (targetTypeName === 'ZodNumber') {
      return Number(value);
    }

    if (targetTypeName === 'ZodBigInt') {
      return BigInt(value);
    }

    throw new Error(`Cannot convert Boolean to ${targetSchema._def.typeName}`);
  }

  static getDefaultPrimitiveValue(targetSchema: ZodTypeAny) {
    if (!targetSchema) return null;

    const targetTypeName = zodTypeName(targetSchema);

    if (targetTypeName === 'ZodNumber') {
      return 0;
    } else if (targetTypeName === 'ZodBoolean') {
      return false;
    } else if (targetTypeName === 'ZodString') {
      return '';
    }

    throw new Error(
      `Unsupported primitive type: ${targetSchema._def.typeName}`,
    );
  }
}

function zodTypeName(schema: ZodTypeAny): string {
  return String(schema._def.typeName);
}
