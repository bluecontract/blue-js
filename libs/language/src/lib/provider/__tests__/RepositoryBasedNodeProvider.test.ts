import { describe, expect, it } from 'vitest';
import { RepositoryBasedNodeProvider } from '../RepositoryBasedNodeProvider';
import { BlueNode } from '../../model';
import { NodeToMapListOrValue } from '../../utils';

describe('RepositoryBasedNodeProvider', () => {
  it('maps historical BlueIds in hasBlueId', () => {
    const historicalId = 'old-id';
    const currentId = 'current-id';
    const toCurrentBlueIdIndex: Record<string, string> = {
      [historicalId]: currentId,
      [currentId]: currentId,
    };

    const typeNode = new BlueNode('TestType');
    const typesMeta = {
      [currentId]: {
        status: 'stable' as const,
        name: 'TestType',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: currentId,
            attributesAdded: [],
          },
        ],
      },
    };
    const repository = {
      name: 'test.repo',
      repositoryVersions: ['R0'],
      packages: {
        test: {
          name: 'test',
          aliases: { 'test/TestType': currentId },
          typesMeta,
          contents: {
            [currentId]: NodeToMapListOrValue.get(typeNode),
          },
          schemas: {},
        },
      },
    };

    const mapper = (blueId: string) => toCurrentBlueIdIndex[blueId] ?? blueId;

    const provider = new RepositoryBasedNodeProvider([repository], mapper);

    expect(provider.hasBlueId(historicalId)).toBe(true);
    const fetched = provider.fetchByBlueId(historicalId);
    expect(fetched?.[0]?.getBlueId()).toEqual(historicalId);
  });

  it('indexes names for new-style repositories', () => {
    const typeId = 'type-1';
    const typeNode = new BlueNode('NamedType');
    const typesMeta = {
      [typeId]: {
        status: 'stable' as const,
        name: 'NamedType',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: typeId,
            attributesAdded: [],
          },
        ],
      },
    };

    const repository = {
      name: 'test.repo',
      repositoryVersions: ['R0'],
      packages: {
        test: {
          name: 'test',
          aliases: { 'test/NamedType': typeId },
          typesMeta,
          contents: {
            [typeId]: NodeToMapListOrValue.get(typeNode),
          },
          schemas: {},
        },
      },
    };

    const provider = new RepositoryBasedNodeProvider([repository]);
    const found = provider.findNodeByName('NamedType');
    expect(found?.getBlueId()).toEqual(typeId);
  });

  it('returns deterministic #idx blueIds for multi-document content', () => {
    const listId = 'multi-doc';
    const first = new BlueNode('First');
    const second = new BlueNode('Second');
    const typesMeta = {
      [listId]: {
        status: 'stable' as const,
        name: 'Multi',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: listId,
            attributesAdded: [],
          },
        ],
      },
    };

    const repository = {
      name: 'test.repo',
      repositoryVersions: ['R0'],
      packages: {
        test: {
          name: 'test',
          aliases: { 'test/Multi': listId },
          typesMeta,
          contents: {
            [listId]: [
              NodeToMapListOrValue.get(first),
              NodeToMapListOrValue.get(second),
            ],
          },
          schemas: {},
        },
      },
    };

    const provider = new RepositoryBasedNodeProvider([repository]);
    const items = provider.fetchByBlueId(listId);
    expect(items?.map((n) => n.getBlueId())).toEqual([
      `${listId}#0`,
      `${listId}#1`,
    ]);

    const byName = provider.findNodeByName('First');
    expect(byName?.getBlueId()).toEqual(`${listId}#0`);
  });
});
