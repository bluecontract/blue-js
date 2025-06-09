import { isNonNullable } from '../typeGuards';

/**
 * Deeply freezes an object recursively
 *
 * @param obj - The object to freeze
 * @returns The frozen object
 */
export function deepFreeze<T>(obj: T): T {
  if (Object.isFrozen(obj)) {
    return obj;
  }

  Object.freeze(obj);

  for (const key of Object.getOwnPropertyNames(obj)) {
    const value = obj[key as keyof T];

    if (isNonNullable(value) && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return obj;
}
