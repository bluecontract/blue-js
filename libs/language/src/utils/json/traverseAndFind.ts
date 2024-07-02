import { JsonBlueValue } from '../../types';

export const traverseAndFind = (
  obj: JsonBlueValue,
  predicate: (obj: JsonBlueValue) => boolean
) => {
  const results: JsonBlueValue[] = [];

  const traverse = (obj: JsonBlueValue) => {
    if (Array.isArray(obj)) {
      obj.forEach((item) => traverse(item));
    } else if (typeof obj === 'object' && obj !== null) {
      if (predicate(obj)) {
        results.push(obj);
      }

      Object.values(obj).forEach((value) => traverse(value));
    }
  };

  traverse(obj);
  return results;
};
