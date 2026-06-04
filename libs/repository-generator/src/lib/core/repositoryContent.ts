import {
  canonicalizeRepositoryContent,
  type JsonBlueValue,
} from '@blue-labs/language';
import type { JsonValue } from '@blue-labs/shared-utils';
import type { JsonMap } from './internalTypes';

export function canonicalizeRepositoryStorageContent(
  content: JsonValue,
): JsonValue {
  return canonicalizeRepositoryContent(content as JsonBlueValue) as JsonValue;
}

export function canonicalizeRepositoryStorageMap(content: JsonMap): JsonMap {
  return canonicalizeRepositoryStorageContent(content) as JsonMap;
}
