import { JsonBlueValue } from '@blue-labs/language';
import { BlueTypeVersion } from '../types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPlainObject(
  value: unknown,
): value is Record<string, JsonBlueValue> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.getPrototypeOf(value) === Object.prototype;
}

export function cloneJson<T extends JsonBlueValue>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJson(item as JsonBlueValue)) as T;
  }

  if (isPlainObject(value)) {
    const copy: Record<string, JsonBlueValue> = {};
    for (const [key, val] of Object.entries(value)) {
      copy[key] = cloneJson(val as JsonBlueValue);
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
