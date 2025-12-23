import { describe, expect, it } from 'vitest';
import { collectDropPointers } from '../dropPointers';

describe('collectDropPointers', () => {
  it('returns empty when no versions are newer than target', () => {
    const versions = [
      { repositoryVersionIndex: 0, attributesAdded: ['/a'] },
      { repositoryVersionIndex: 1, attributesAdded: ['/b/c'] },
    ] as const;

    expect(collectDropPointers(versions, 2)).toEqual([]);
    expect(collectDropPointers(versions, 1)).toEqual([]);
  });

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

  it('keeps version ordering even when depth is larger in older versions', () => {
    const versions = [
      { repositoryVersionIndex: 1, attributesAdded: ['/a/b/c'] },
      { repositoryVersionIndex: 2, attributesAdded: ['/z'] },
    ] as const;

    const result = collectDropPointers(versions, 0);

    expect(result).toEqual(['/z', '/a/b/c']);
  });

  it('preserves duplicate pointers', () => {
    const versions = [
      { repositoryVersionIndex: 2, attributesAdded: ['/a', '/a/b'] },
      { repositoryVersionIndex: 3, attributesAdded: ['/a'] },
    ] as const;

    const result = collectDropPointers(versions, 0);

    expect(result).toEqual(['/a', '/a/b', '/a']);
  });

  it('throws on invalid pointer syntax', () => {
    const versions = [
      { repositoryVersionIndex: 1, attributesAdded: ['/a~2b', '/valid'] },
    ] as const;

    expect(() => collectDropPointers(versions, 0)).toThrow();
  });
});
