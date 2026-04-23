import { describe, expect, it } from 'vitest';
import { SpecCanonicalNormalizer } from '../SpecCanonicalNormalizer';
import { UnsupportedFeatureError } from '../UnsupportedFeatureError';

describe('SpecCanonicalNormalizer', () => {
  it('preserves empty arrays as content while cleaning nulls', () => {
    const normalized = SpecCanonicalNormalizer.normalize({
      a: 1,
      b: null,
      c: [],
      d: { nested: null },
    });

    expect(normalized).toEqual({
      a: 1,
      c: [],
    });
  });

  it('retains non-empty nested structures', () => {
    const normalized = SpecCanonicalNormalizer.normalize({
      root: {
        child: {
          value: 1,
        },
      },
    });

    expect(normalized).toEqual({
      root: {
        child: {
          value: 1,
        },
      },
    });
  });

  it('throws unsupported feature error for this#', () => {
    expect(() =>
      SpecCanonicalNormalizer.normalize({
        type: { blueId: 'this#4' },
      }),
    ).toThrowError(UnsupportedFeatureError);
  });
});
