import { describe, expect, it } from 'vitest';
import { toTypeAlias } from '../type-alias.js';

describe('core/type-alias', () => {
  it('normalizes built-in constructor aliases', () => {
    expect(toTypeAlias(String)).toBe('Text');
    expect(toTypeAlias(Number)).toBe('Integer');
  });

  it('rejects empty string aliases after trimming', () => {
    expect(() => toTypeAlias('   ')).toThrow(
      /cannot resolve type alias from empty string/i,
    );
  });
});
