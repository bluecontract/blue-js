import { describe, expect, it } from 'vitest';
import { getPointer, removePointer, setPointer } from '../pointers.js';
import type { JsonObject } from '../types.js';

describe('core/pointers', () => {
  it('sets nested object pointer and reads it back', () => {
    const root: JsonObject = {};
    setPointer(root, '/a/b/c', 7);

    expect(root).toEqual({ a: { b: { c: 7 } } });
    expect(getPointer(root, '/a/b/c')).toBe(7);
  });

  it('creates arrays when numeric segments are used', () => {
    const root: JsonObject = {};
    setPointer(root, '/items/0/name', 'first');
    setPointer(root, '/items/1/name', 'second');

    expect(root).toEqual({
      items: [{ name: 'first' }, { name: 'second' }],
    });
    expect(getPointer(root, '/items/1/name')).toBe('second');
  });

  it('throws when pointer targets root', () => {
    const root: JsonObject = {};
    expect(() => setPointer(root, '/', 1)).toThrow(/root/i);
    expect(() => removePointer(root, '/')).toThrow(/root/i);
  });

  it('removes object keys and array indexes', () => {
    const root: JsonObject = {
      status: 'ready',
      items: [{ id: 1 }, { id: 2 }, { id: 3 }],
    };

    removePointer(root, '/status');
    removePointer(root, '/items/1');

    expect(root).toEqual({
      items: [{ id: 1 }, { id: 3 }],
    });
  });

  it('supports strict traversal when createMissing is false', () => {
    const root: JsonObject = {};
    expect(() =>
      setPointer(root, '/missing/path', 'value', { createMissing: false }),
    ).toThrow(/missing/i);
  });
});
