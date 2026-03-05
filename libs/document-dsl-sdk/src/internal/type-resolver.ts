import { getTypeBlueIdAnnotation } from '@blue-labs/language';
import type { z } from 'zod';
import type { BlueTypeInput } from '../types.js';

const isZodSchema = (value: BlueTypeInput): value is z.ZodTypeAny =>
  typeof value === 'object' &&
  value !== null &&
  '_def' in value &&
  typeof (value as { parse?: unknown }).parse === 'function';

export const resolveTypeInput = (typeInput: BlueTypeInput): string | { blueId: string } => {
  if (typeof typeInput === 'string') {
    return typeInput;
  }

  if ('blueId' in typeInput) {
    return { blueId: typeInput.blueId };
  }

  if (isZodSchema(typeInput)) {
    const annotation = getTypeBlueIdAnnotation(typeInput);
    if (annotation && annotation.blueId.length > 0) {
      return { blueId: annotation.blueId[0] };
    }
    throw new Error(
      'Zod schema does not include blueId annotation. Use alias string or annotate schema type.',
    );
  }

  throw new Error('Unsupported type input.');
};
