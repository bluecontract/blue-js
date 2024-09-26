import { jsonTraverseAndFind } from '../jsonTraverseAndFind';
import { JsonValue } from '../schema';

describe('jsonTraverseAndFind', () => {
  const testObject: JsonValue = {
    a: 1,
    b: {
      c: 2,
      d: [3, 4, { e: 5 }],
    },
    f: [6, 7, 8],
    g: null,
    h: 'test',
  };

  it('should find all numbers greater than 3', () => {
    const result = jsonTraverseAndFind(
      testObject,
      (value) => typeof value === 'number' && value > 3
    );
    expect(result).toEqual([
      { value: 4, path: ['b', 'd', '1'] },
      { value: 5, path: ['b', 'd', '2', 'e'] },
      { value: 6, path: ['f', '0'] },
      { value: 7, path: ['f', '1'] },
      { value: 8, path: ['f', '2'] },
    ]);
  });

  it('should find all arrays', () => {
    const result = jsonTraverseAndFind(testObject, (value) =>
      Array.isArray(value)
    );
    expect(result).toEqual([
      { value: [3, 4, { e: 5 }], path: ['b', 'd'] },
      { value: [6, 7, 8], path: ['f'] },
    ]);
  });

  it('should find all string values', () => {
    const result = jsonTraverseAndFind(
      testObject,
      (value) => typeof value === 'string'
    );
    expect(result).toEqual([{ value: 'test', path: ['h'] }]);
  });

  it('should find all null values', () => {
    const result = jsonTraverseAndFind(testObject, (value) => value === null);
    expect(result).toEqual([{ value: null, path: ['g'] }]);
  });

  it('should find values based on path', () => {
    const result = jsonTraverseAndFind(testObject, (_, path) =>
      path.includes('d')
    );
    expect(result).toEqual([
      { value: [3, 4, { e: 5 }], path: ['b', 'd'] },
      { value: 3, path: ['b', 'd', '0'] },
      { value: 4, path: ['b', 'd', '1'] },
      { value: { e: 5 }, path: ['b', 'd', '2'] },
      { value: 5, path: ['b', 'd', '2', 'e'] },
    ]);
  });

  it('should return an empty array when no matches are found', () => {
    const result = jsonTraverseAndFind(testObject, () => false);
    expect(result).toEqual([]);
  });

  it('should handle an empty object', () => {
    const result = jsonTraverseAndFind({}, () => true);
    expect(result).toEqual([{ value: {}, path: [] }]);
  });

  it('should handle a simple value', () => {
    const result = jsonTraverseAndFind(
      42,
      (value) => typeof value === 'number'
    );
    expect(result).toEqual([{ value: 42, path: [] }]);
  });
});
