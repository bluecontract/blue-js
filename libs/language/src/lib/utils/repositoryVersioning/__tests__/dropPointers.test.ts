import { describe, expect, it } from 'vitest';
import { collectDropPointers } from '../dropPointers';

describe('collectDropPointers', () => {
  it('orders pointers by descending repo index and depth within each version', () => {
    const versions = [
      { repositoryVersionIndex: 1, attributesAdded: ['/newProp'] },
      {
        repositoryVersionIndex: 2,
        attributesAdded: ['/newProp/newerNestedProp', '/x', '/x/y/z'],
      },
    ] as const;

    const result = collectDropPointers(versions, 0);

    expect(result).toEqual([
      '/x/y/z',
      '/newProp/newerNestedProp',
      '/x',
      '/newProp',
    ]);
  });
});
