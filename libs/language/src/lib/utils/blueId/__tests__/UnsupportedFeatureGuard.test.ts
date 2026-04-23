import { describe, expect, it } from 'vitest';
import { UnsupportedFeatureGuard } from '../UnsupportedFeatureGuard';
import { UnsupportedFeatureError } from '../UnsupportedFeatureError';

describe('UnsupportedFeatureGuard', () => {
  it('allows regular values and $empty content', () => {
    expect(() =>
      UnsupportedFeatureGuard.assertSupported({
        value: true,
        marker: { $empty: true },
      }),
    ).not.toThrow();
  });

  it('throws for this# references', () => {
    expect(() =>
      UnsupportedFeatureGuard.assertSupported({
        type: { blueId: 'this#1' },
      }),
    ).toThrowError(UnsupportedFeatureError);
  });

  it('throws for $pos objects', () => {
    expect(() =>
      UnsupportedFeatureGuard.assertSupported({
        list: { $pos: 3, value: 'A' },
      }),
    ).toThrowError(UnsupportedFeatureError);
  });

  it('throws for $previous objects', () => {
    expect(() =>
      UnsupportedFeatureGuard.assertSupported({
        list: { $previous: true },
      }),
    ).toThrowError(UnsupportedFeatureError);
  });
});
