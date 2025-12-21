import type { JsonValue } from '@blue-labs/shared-utils';
import { BlueTypeVersion } from '../types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPlainObject(
  value: unknown,
): value is Record<string, JsonValue> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.getPrototypeOf(value) === Object.prototype;
}

export function cloneJson<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJson(item as JsonValue)) as T;
  }

  if (isPlainObject(value)) {
    const copy: Record<string, JsonValue> = {};
    for (const [key, val] of Object.entries(value)) {
      copy[key] = cloneJson(val as JsonValue);
    }
    return copy as T;
  }

  return value;
}

export function cloneVersions(versions: BlueTypeVersion[]): BlueTypeVersion[] {
  return versions.map((v) => ({
    repositoryVersionIndex: v.repositoryVersionIndex,
    typeBlueId: v.typeBlueId,
    attributesAdded: [...v.attributesAdded],
  }));
}
