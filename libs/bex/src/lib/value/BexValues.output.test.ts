import { describe, expect, it } from 'vitest';
import { BexValues } from './BexValues';

describe('BEX strict Blue output boundary', () => {
  it('converts simple values to Blue nodes', () => {
    expect(BexValues.toBlueNodeStrict(null).getProperties()).toBeUndefined();
    expect(BexValues.toBlueNodeStrict('hello').getValue()).toBe('hello');
    expect(BexValues.toBlueNodeStrict([1, 'two']).getItems()).toHaveLength(2);
    expect(
      BexValues.toBlueNodeStrict({ answer: 42 }).getProperties()?.answer,
    ).toBeDefined();
  });

  it('rejects undefined root and list items', () => {
    expect(() => BexValues.toBlueNodeStrict(undefined)).toThrow(/undefined/);
    expect(() => BexValues.toBlueNodeStrict([1, undefined])).toThrow(
      /undefined/,
    );
  });

  it('rejects mixed blueId and unsupported wrapper fields', () => {
    expect(() =>
      BexValues.toBlueNodeStrict({ blueId: 'abc', name: 'mixed' }),
    ).toThrow(/mixed blueId/);
    expect(() => BexValues.toBlueNodeStrict({ properties: {} })).toThrow(
      /properties wrapper/,
    );
    expect(() => BexValues.toBlueNodeStrict({ constraints: {} })).toThrow(
      /constraints/,
    );
  });

  it('rejects mixed payload kinds and list-control output fields', () => {
    expect(() => BexValues.toBlueNodeStrict({ value: 1, child: true })).toThrow(
      /mixes payload kinds/,
    );
    expect(() =>
      BexValues.toBlueNodeStrict({ items: [], child: true }),
    ).toThrow(/mixes payload kinds/);
    expect(() => BexValues.toBlueNodeStrict({ $empty: true })).toThrow(
      /list-control/,
    );
  });
});
