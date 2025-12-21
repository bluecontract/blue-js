import { BlueIdCalculator } from '@blue-labs/language';
import type { JsonValue } from '@blue-labs/shared-utils';
import { Alias, DiscoveredType, JsonMap } from './internalTypes';
import { PRIMITIVE_BLUE_IDS, PRIMITIVE_TYPES } from './constants';
import { cloneJson, isPlainObject, isRecord } from './utils';

export function computeBlueIds(
  topoOrder: Alias[],
  discovered: Map<Alias, DiscoveredType>,
): {
  aliasToBlueId: Map<Alias, string>;
  aliasToPreprocessed: Map<Alias, JsonMap>;
} {
  const aliasToBlueId = new Map<Alias, string>();
  const aliasToPreprocessed = new Map<Alias, JsonMap>();

  for (const alias of topoOrder) {
    const type = discovered.get(alias);
    if (!type) {
      continue;
    }
    const substituted = substituteAliases(
      cloneJson(type.content),
      aliasToBlueId,
    ) as JsonMap;
    const normalized = normalizeForBlueId(substituted) as JsonMap;

    const blueId = PRIMITIVE_TYPES.has(type.typeName)
      ? getPrimitiveBlueId(type.typeName)
      : BlueIdCalculator.INSTANCE.calculateSync(normalized);

    aliasToBlueId.set(alias, blueId);
    aliasToPreprocessed.set(alias, normalized);
  }

  return { aliasToBlueId, aliasToPreprocessed };
}

export function substituteAliases(
  content: JsonValue,
  aliasToBlueId: Map<Alias, string>,
  skipContracts = false,
  underContracts = false,
): JsonValue {
  if (Array.isArray(content)) {
    return content.map((item) =>
      substituteAliases(
        item as JsonValue,
        aliasToBlueId,
        skipContracts,
        underContracts,
      ),
    );
  }

  if (!isRecord(content)) {
    return content;
  }

  const updated: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(content)) {
    const inContracts = underContracts || key === 'contracts';

    if (
      (key === 'type' ||
        key === 'itemType' ||
        key === 'keyType' ||
        key === 'valueType') &&
      typeof value === 'string' &&
      !(skipContracts && inContracts)
    ) {
      if (PRIMITIVE_TYPES.has(value)) {
        const primitiveId = PRIMITIVE_BLUE_IDS[value];
        if (!primitiveId) {
          throw new Error(`Missing primitive BlueId for ${value}.`);
        }
        updated[key] = { blueId: primitiveId };
      } else {
        const alias = value as Alias;
        const blueId = aliasToBlueId.get(alias);
        if (!blueId) {
          throw new Error(`Missing BlueId for alias ${alias}.`);
        }
        updated[key] = { blueId };
      }
      continue;
    }

    updated[key] = substituteAliases(
      value as JsonValue,
      aliasToBlueId,
      skipContracts,
      inContracts,
    );
  }

  return updated;
}

export function normalizeForBlueId(
  value: JsonValue,
  parentHasExplicitType = false,
): JsonValue {
  if (Array.isArray(value)) {
    const items = value.map((item) =>
      normalizeForBlueId(item as JsonValue),
    );
    return { items };
  }

  if (isPlainObject(value)) {
    if (isBlueIdReference(value)) {
      return { blueId: value.blueId };
    }

    const currentHasExplicitType = hasExplicitType(value);
    const normalized: Record<string, JsonValue> = {};

    for (const [key, val] of Object.entries(value)) {
      if (isPrimitiveValue(val)) {
        if (shouldSkipWrappingPrimitive(key, currentHasExplicitType)) {
          normalized[key] = val as JsonValue;
        } else {
          normalized[key] = wrapPrimitive(
            val as string | number | boolean | null,
          );
        }
        continue;
      }

      normalized[key] = normalizeForBlueId(
        val as JsonValue,
        currentHasExplicitType,
      );
    }

    return normalized;
  }

  if (isPrimitiveValue(value)) {
    if (parentHasExplicitType) {
      return value;
    }
    return wrapPrimitive(value as string | number | boolean | null);
  }

  return value;
}

function getPrimitiveBlueId(typeName: string): string {
  const primitiveId = PRIMITIVE_BLUE_IDS[typeName];
  if (!primitiveId) {
    throw new Error(`Missing primitive BlueId for ${typeName}.`);
  }
  return primitiveId;
}

function wrapPrimitive(value: string | number | boolean | null): JsonMap {
  const blueId = inferPrimitiveBlueId(value);
  const wrapped: JsonMap = { value };
  if (blueId) {
    wrapped.type = { blueId };
  }
  return wrapped;
}

function inferPrimitiveBlueId(
  value: string | number | boolean | null,
): string | null {
  if (typeof value === 'string') {
    return PRIMITIVE_BLUE_IDS.Text;
  }
  if (typeof value === 'boolean') {
    return PRIMITIVE_BLUE_IDS.Boolean;
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? PRIMITIVE_BLUE_IDS.Integer
      : PRIMITIVE_BLUE_IDS.Double;
  }
  return null;
}

function isPrimitiveValue(
  value: unknown,
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isBlueIdReference(
  value: Record<string, JsonValue>,
): value is { blueId: string } {
  const entries = Object.entries(value);
  return (
    entries.length === 1 &&
    entries[0]?.[0] === 'blueId' &&
    typeof entries[0]?.[1] === 'string'
  );
}

function hasExplicitType(value: Record<string, JsonValue>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(value, 'type') ||
    Object.prototype.hasOwnProperty.call(value, 'itemType') ||
    Object.prototype.hasOwnProperty.call(value, 'keyType') ||
    Object.prototype.hasOwnProperty.call(value, 'valueType')
  );
}

const PRIMITIVE_SKIP_KEYS = new Set(['name', 'description', 'blueId']);

function shouldSkipWrappingPrimitive(
  key: string,
  parentHasExplicitType: boolean,
): boolean {
  if (PRIMITIVE_SKIP_KEYS.has(key)) {
    return true;
  }
  if (parentHasExplicitType && key === 'value') {
    return true;
  }
  return false;
}
