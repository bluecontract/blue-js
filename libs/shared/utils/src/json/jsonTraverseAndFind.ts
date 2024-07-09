import { JsonValue } from './schema';

export const jsonTraverseAndFind = <T extends JsonValue, TObject = T>(
  obj: TObject,
  predicate: (obj: TObject) => boolean
) => {
  const results: TObject[] = [];

  const traverse = (obj: TObject) => {
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
