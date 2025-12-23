import { describe, expect, it } from 'vitest';
import {
  collectTypeRefsFromContent,
  validateNoCycles,
  validateStableDoesNotDependOnDev,
} from './refs.js';
import type { BlueRepository } from './types.js';

describe('refs utilities', () => {
  it('collects references from inline shapes', () => {
    const refs = collectTypeRefsFromContent({
      type: 'Package/CustomType',
      nested: {
        keyType: { blueId: 'blue/key' },
        child: { valueType: 'Package/Number' },
      },
      itemType: 'Package/Array',
    });
    expect(refs).toEqual(
      new Set([
        'Package/CustomType',
        'blue/key',
        'Package/Number',
        'Package/Array',
      ]),
    );
  });

  it('detects cycles across properties', () => {
    const repo: BlueRepository = {
      name: 'test',
      repositoryVersions: [],
      packages: {
        pkg: {
          name: 'pkg',
          aliases: { 'pkg/A': 'A', 'pkg/B': 'B' },
          typesMeta: {
            A: { name: 'A', status: 'stable', versions: [] },
            B: { name: 'B', status: 'stable', versions: [] },
          },
          contents: {
            A: { fields: { ref: { type: 'pkg/B' } } },
            B: { fields: { ref: { type: 'pkg/A' } } },
          },
          schemas: {},
        },
      },
    };

    expect(() => validateNoCycles(repo)).toThrowError(/cycle/i);
  });

  it('rejects stable depending on dev across packages', () => {
    const repo: BlueRepository = {
      name: 'test',
      repositoryVersions: [],
      packages: {
        a: {
          name: 'a',
          aliases: { 'a/A': 'A' },
          typesMeta: { A: { name: 'A', status: 'stable', versions: [] } },
          contents: {
            A: { type: 'b/B' },
          },
          schemas: {},
        },
        b: {
          name: 'b',
          aliases: { 'b/B': 'B' },
          typesMeta: { B: { name: 'B', status: 'dev', versions: [] } },
          contents: { B: {} },
          schemas: {},
        },
      },
    };

    expect(() => validateStableDoesNotDependOnDev(repo)).toThrowError(
      /dev type/i,
    );
  });
});
