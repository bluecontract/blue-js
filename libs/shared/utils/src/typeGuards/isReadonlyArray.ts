export const isReadonlyArray = <T>(value: unknown): value is readonly T[] =>
  Array.isArray(value);
