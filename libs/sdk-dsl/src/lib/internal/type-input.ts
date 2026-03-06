import { BlueNode, getTypeBlueIdAnnotation } from '@blue-labs/language';
import { z } from 'zod';

import type { BlueIdLike, TypeInput } from '../types.js';

function isBlueIdLike(value: unknown): value is BlueIdLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'blueId' in value &&
    typeof value.blueId === 'string'
  );
}

export function resolveTypeInput(typeInput: TypeInput): BlueNode {
  if (typeof typeInput === 'string') {
    const normalized = typeInput.trim();
    if (normalized.length === 0) {
      throw new Error('Type input cannot be empty.');
    }
    return new BlueNode().setValue(normalized).setInlineValue(true);
  }

  if (typeInput instanceof BlueNode) {
    return typeInput.clone();
  }

  if (isBlueIdLike(typeInput)) {
    const normalized = typeInput.blueId.trim();
    if (normalized.length === 0) {
      throw new Error('Type input blueId cannot be empty.');
    }
    return new BlueNode().setBlueId(normalized);
  }

  if (typeInput instanceof z.ZodType) {
    const annotation = getTypeBlueIdAnnotation(typeInput);
    const blueId = annotation?.value?.[0] ?? annotation?.defaultValue;
    if (!blueId || blueId.trim().length === 0) {
      throw new Error(
        'Zod type input must have a non-empty typeBlueId annotation.',
      );
    }
    return new BlueNode().setBlueId(blueId.trim());
  }

  throw new Error('Unsupported type input.');
}
