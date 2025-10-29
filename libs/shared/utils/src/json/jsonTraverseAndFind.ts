import { jsonTraverse } from './jsonTraverse';
import { JsonValue } from './schema';

export const jsonTraverseAndFind = (
  obj: JsonValue,
  predicate: (value: JsonValue, path: string[]) => boolean,
): { value: JsonValue; path: string[] }[] => {
  const results: { value: JsonValue; path: string[] }[] = [];

  jsonTraverse(obj, (value, path) => {
    if (predicate(value, path)) {
      results.push({ value, path });
    }
  });

  return results;
};
