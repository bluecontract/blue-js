import {
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodBoolean,
  ZodTypeAny,
  ZodEnum,
  ZodNativeEnum,
} from 'zod';
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

    if (
      targetSchema instanceof ZodString ||
      targetSchema instanceof ZodEnum ||
      targetSchema instanceof ZodNativeEnum
    ) {
      return value;
    }

    if (targetSchema instanceof ZodNumber) {
      return Number(value);
    }

    if (targetSchema instanceof ZodBoolean) {
      return value.toLowerCase() === 'true';
    }

    if (targetSchema instanceof ZodBigInt) {
      return BigInt(value);
    }

    throw new Error(`Cannot convert String to ${targetSchema._def.typeName}`);
  }

  private static convertFromBigDecimal(
    value: BigDecimalNumber,
    targetSchema: ZodTypeAny,
  ) {
    if (targetSchema instanceof ZodNumber) {
      return value.toNumber();
    }

    if (targetSchema instanceof ZodString) {
      return value.toString();
    }

    throw new Error(`Cannot convert Number to ${targetSchema._def.typeName}`);
  }

  private static convertFromBigInteger(
    value: BigIntegerNumber,
    targetSchema: ZodTypeAny,
  ) {
    if (targetSchema instanceof ZodNumber) {
      return value.toNumber();
    }

    if (targetSchema instanceof ZodBigInt) {
      return BigInt(value.toString());
    }

    if (targetSchema instanceof ZodString) {
      return value.toString();
    }

    throw new Error(`Cannot convert Number to ${targetSchema._def.typeName}`);
  }

  private static convertFromBoolean(value: boolean, targetSchema: ZodTypeAny) {
    if (!targetSchema) return value;

    if (targetSchema instanceof ZodBoolean) {
      return value;
    }

    if (targetSchema instanceof ZodString) {
      return value.toString();
    }

    if (targetSchema instanceof ZodNumber) {
      return Number(value);
    }

    if (targetSchema instanceof ZodBigInt) {
      return BigInt(value);
    }

    throw new Error(`Cannot convert Boolean to ${targetSchema._def.typeName}`);
  }

  static getDefaultPrimitiveValue(targetSchema: ZodTypeAny) {
    if (!targetSchema) return null;

    if (targetSchema instanceof ZodNumber) {
      return 0;
    } else if (targetSchema instanceof ZodBoolean) {
      return false;
    } else if (targetSchema instanceof ZodString) {
      return '';
    }

    throw new Error(
      `Unsupported primitive type: ${targetSchema._def.typeName}`,
    );
  }
}
