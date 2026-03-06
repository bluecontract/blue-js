import { BlueNode, getTypeBlueIdAnnotation } from '@blue-labs/language';
import type { ZodTypeAny } from 'zod';

import type { TypeInput } from '../types';
import { INTERNAL_BLUE } from './blue';
import { normalizeBlueNodeInput } from './value-to-node';

export function resolveTypeInput(
  input: TypeInput,
  context = 'type input',
): BlueNode {
  if (input instanceof BlueNode) {
    return normalizeBlueNodeInput(input);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      throw new Error(`${context} is required`);
    }

    try {
      const container = INTERNAL_BLUE.jsonValueToNode({
        type: trimmed,
      });
      const typeNode = container.getType();
      if (!typeNode) {
        throw new Error(`Failed to resolve ${context}: ${trimmed}`);
      }
      return typeNode.clone();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes(`Unknown type "${trimmed}"`)
      ) {
        return new BlueNode().setValue(trimmed).setInlineValue(true);
      }

      throw error;
    }
  }

  if (isBlueIdObject(input)) {
    const blueId = input.blueId.trim();
    if (blueId.length === 0) {
      throw new Error(`${context} blueId is required`);
    }
    return new BlueNode().setBlueId(blueId);
  }

  if (isLikelyZodSchema(input)) {
    const annotation = getTypeBlueIdAnnotation(input);
    const blueId = annotation?.value?.[0] ?? annotation?.defaultValue;
    if (typeof blueId !== 'string' || blueId.trim().length === 0) {
      throw new Error(`${context} schema must declare a typeBlueId annotation`);
    }
    return new BlueNode().setBlueId(blueId.trim());
  }

  throw new Error(`Unsupported ${context}`);
}

function isBlueIdObject(value: unknown): value is { blueId: string } {
  return (
    value != null &&
    typeof value === 'object' &&
    'blueId' in value &&
    typeof (value as { blueId?: unknown }).blueId === 'string'
  );
}

function isLikelyZodSchema(value: unknown): value is ZodTypeAny {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { safeParse?: unknown }).safeParse === 'function' &&
    '_def' in value
  );
}
