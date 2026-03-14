import type { BlueObject } from '../types.js';

export const createOrderedObject = (
  entries: Array<[string, unknown]>,
): BlueObject => {
  const ordered = Object.create(null) as BlueObject;
  for (const [key, value] of entries) {
    if (value !== undefined) {
      ordered[key] = value as never;
    }
  }
  return ordered;
};
