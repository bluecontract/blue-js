import { describe, expect, it } from 'vitest';
import {
  InvalidRepositoryPointerError,
  parsePointer,
  RESERVED_ATTRIBUTES_POINTER_SEGMENTS,
  unescapePointerToken,
  validateAttributesAddedPointer,
  validatePointer,
} from './pointers.js';

describe('pointers', () => {
  it('parses and unescapes a valid pointer', () => {
    expect(parsePointer('/a/b~1c/~0d')).toEqual(['a', 'b/c', '~d']);
    expect(parsePointer('')).toEqual([]);
    expect(unescapePointerToken('foo~1bar~0baz')).toBe('foo/bar~baz');
  });

  it('rejects missing leading slash', () => {
    expect(() => parsePointer('a/b')).toThrow(InvalidRepositoryPointerError);
  });

  it('rejects empty segments', () => {
    expect(() => parsePointer('/a//b')).toThrow(InvalidRepositoryPointerError);
  });

  it('rejects invalid escapes', () => {
    expect(() => unescapePointerToken('foo~2bar')).toThrow(
      InvalidRepositoryPointerError,
    );
  });

  it('validatePointer rethrows invalid pointers', () => {
    expect(() => validatePointer('/a//b')).toThrow(
      InvalidRepositoryPointerError,
    );
  });

  it('validateAttributesAddedPointer rejects reserved segments', () => {
    expect(RESERVED_ATTRIBUTES_POINTER_SEGMENTS.has('schema')).toBe(true);
    expect(() => validateAttributesAddedPointer('/schema/min')).toThrow(
      InvalidRepositoryPointerError,
    );
  });

  it('validateAttributesAddedPointer allows itemType/valueType paths', () => {
    expect(() =>
      validateAttributesAddedPointer('/prop/itemType/x'),
    ).not.toThrow(InvalidRepositoryPointerError);
    expect(() =>
      validateAttributesAddedPointer('/prop/valueType/x'),
    ).not.toThrow(InvalidRepositoryPointerError);
    expect(() =>
      validateAttributesAddedPointer('/prop/keyType/x'),
    ).not.toThrow(InvalidRepositoryPointerError);
    expect(() =>
      validateAttributesAddedPointer('/prop/type/x'),
    ).not.toThrow(InvalidRepositoryPointerError);
  });

  it('validateAttributesAddedPointer rejects pointers ending in itemType/valueType', () => {
    expect(() => validateAttributesAddedPointer('/prop/itemType')).toThrow(
      InvalidRepositoryPointerError,
    );
    expect(() => validateAttributesAddedPointer('/prop/valueType')).toThrow(
      InvalidRepositoryPointerError,
    );
    expect(() => validateAttributesAddedPointer('/prop/keyType')).toThrow(
      InvalidRepositoryPointerError,
    );
    expect(() => validateAttributesAddedPointer('/prop/type')).toThrow(
      InvalidRepositoryPointerError,
    );
  });
});
