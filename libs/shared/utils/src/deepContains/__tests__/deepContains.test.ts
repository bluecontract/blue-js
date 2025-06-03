import { describe, it, expect } from 'vitest';
import { deepContains } from '../deepContains';

describe('deepContains()', () => {
  /* ------------------------------------------------------------------ *
   *  PRIMITIVES & EDGE-CASE VALUES                                     *
   * ------------------------------------------------------------------ */
  it('handles primitive equality (numbers, strings, NaN, -0)', () => {
    expect(deepContains(5, 5)).toBe(true);
    expect(deepContains('foo', 'foo')).toBe(true);
    expect(deepContains(NaN, NaN)).toBe(true);
    expect(deepContains(-0, -0)).toBe(true);

    expect(deepContains(5, 6)).toBe(false);
    expect(deepContains('foo', 'bar')).toBe(false);
  });

  it('compares Date and RegExp values correctly', () => {
    const d1 = new Date('2024-01-01T00:00:00Z');
    const d2 = new Date('2024-01-01T00:00:00Z');
    const d3 = new Date('2025-01-01T00:00:00Z');

    expect(deepContains({ when: d1 }, { when: d2 })).toBe(true);
    expect(deepContains({ when: d1 }, { when: d3 })).toBe(false);

    expect(deepContains({ re: /foo/i }, { re: /foo/i })).toBe(true);
    expect(deepContains({ re: /foo/i }, { re: /foo/g })).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   *  OBJECT & NESTED STRUCTURES                                        *
   * ------------------------------------------------------------------ */
  it('confirms a plain object subset', () => {
    const original = { a: 1, b: 2, c: 3 };
    const pattern = { b: 2 };

    expect(deepContains(original, pattern)).toBe(true);
  });

  it('works on deeply-nested structures', () => {
    const original = { user: { id: 7, info: { name: 'Ada' } } };
    const pattern = { user: { info: { name: 'Ada' } } };

    expect(deepContains(original, pattern)).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   *  ARRAY SEMANTICS (ORDER-INSENSITIVE SUBSET)                        *
   * ------------------------------------------------------------------ */
  it('treats arrays as order-insensitive supersets', () => {
    expect(deepContains([1, 2, 3], [2])).toBe(true);
    expect(deepContains([1, 2, 3], [3, 1])).toBe(true);
    expect(deepContains([1, 2, 3], [4])).toBe(false);
    expect(deepContains([1, 2], [1, 2, 3])).toBe(false);
  });

  it('matches objects inside arrays', () => {
    const original = [{ id: 1 }, { id: 2 }];
    const pattern = [{ id: 2 }];

    expect(deepContains(original, pattern)).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   *  MAP & SET SUPPORT                                                 *
   * ------------------------------------------------------------------ */
  it('verifies subset of Map entries', () => {
    const original = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const good = new Map([['a', 1]]);
    const bad = new Map([['c', 3]]);

    expect(deepContains(original, good)).toBe(true);
    expect(deepContains(original, bad)).toBe(false);
  });

  it('verifies subset of Set members', () => {
    const original = new Set(['x', 'y', 'z']);
    const good = new Set(['y']);
    const bad = new Set(['y', 'q']);

    expect(deepContains(original, good)).toBe(true);
    expect(deepContains(original, bad)).toBe(false);
  });

  /* ------------------------------------------------------------------ *
   *  TYPE MISMATCH & NEGATIVE CASES                                    *
   * ------------------------------------------------------------------ */
  it('returns false on type mismatch (object vs. array, etc.)', () => {
    expect(deepContains({ a: 1 }, [{ a: 1 }])).toBe(false);
    expect(deepContains([1, 2, 3], { 0: 1 })).toBe(false);
  });
});
