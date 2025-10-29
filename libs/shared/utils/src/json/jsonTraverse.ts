import { isReadonlyArray } from '../typeGuards';
import { JsonValue } from './schema';

export const jsonTraverse = (
  obj: JsonValue,
  callback: (value: JsonValue, path: string[]) => void,
) => {
  const traverse = (value: JsonValue, path: string[] = []) => {
    callback(value, path);

    if (Array.isArray(value) || isReadonlyArray(value)) {
      value.forEach((item, index) =>
        traverse(item, [...path, index.toString()]),
      );
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([key, val]) =>
        traverse(val, [...path, key]),
      );
    }
  };

  traverse(obj);
};
