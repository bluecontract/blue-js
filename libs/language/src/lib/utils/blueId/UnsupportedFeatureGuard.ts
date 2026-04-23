import { JsonBlueArray, JsonBlueObject, JsonBlueValue } from '../../../schema';
import { UnsupportedFeatureError } from './UnsupportedFeatureError';

const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const asPath = (path: string[]): string => {
  if (path.length === 0) {
    return '/';
  }
  return `/${path.join('/')}`;
};

const throwForUnsupportedObjectKeys = (
  obj: JsonBlueObject,
  path: string[],
): void => {
  if (hasOwn(obj, '$pos')) {
    throw new UnsupportedFeatureError('$pos', asPath(path));
  }

  if (hasOwn(obj, '$previous')) {
    throw new UnsupportedFeatureError('$previous', asPath(path));
  }
};

const THIS_REFERENCE_PATTERN = /^this#\d+$/;

const walk = (value: JsonBlueValue, path: string[]): void => {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    if (THIS_REFERENCE_PATTERN.test(value)) {
      throw new UnsupportedFeatureError('this#', asPath(path));
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    (value as JsonBlueArray).forEach((item, index) =>
      walk(item, [...path, String(index)]),
    );
    return;
  }

  const obj = value as JsonBlueObject;
  throwForUnsupportedObjectKeys(obj, path);

  Object.entries(obj).forEach(([key, child]) => walk(child, [...path, key]));
};

export class UnsupportedFeatureGuard {
  public static assertSupported(value: JsonBlueValue): void {
    walk(value, []);
  }
}
