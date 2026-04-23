import {
  isJsonPrimitive,
  isNonNullable,
  isReadonlyArray,
} from '@blue-labs/shared-utils';
import { JsonBlueValue } from '../../../schema';
import { isBigNumber } from '../../../utils/typeGuards';
import { BlueIdHashValue } from './types';
import { UnsupportedFeatureGuard } from './UnsupportedFeatureGuard';

export class SpecCanonicalNormalizer {
  public static normalize(value: JsonBlueValue): BlueIdHashValue {
    UnsupportedFeatureGuard.assertSupported(value);

    const cleaned = this.cleanStructure(value);
    if (cleaned === undefined) {
      throw new Error('Object after cleaning cannot be null or undefined.');
    }
    return cleaned;
  }

  private static cleanStructure(
    value: JsonBlueValue,
  ): BlueIdHashValue | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (isJsonPrimitive(value) || isBigNumber(value)) {
      return value;
    }

    if (Array.isArray(value) || isReadonlyArray(value)) {
      const cleanedList = value
        .map((item) => this.cleanStructure(item))
        .filter(isNonNullable);

      // Empty lists are preserved as content.
      return cleanedList;
    }

    if (typeof value === 'object') {
      const cleanedMap: Record<string, BlueIdHashValue> = {};
      for (const [key, raw] of Object.entries(value)) {
        const cleanedValue = this.cleanStructure(raw);
        if (cleanedValue !== undefined && cleanedValue !== null) {
          cleanedMap[key] = cleanedValue;
        }
      }

      // Empty maps are cleaned out.
      return Object.keys(cleanedMap).length > 0 ? cleanedMap : undefined;
    }

    return value;
  }
}
