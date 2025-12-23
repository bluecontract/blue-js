import { describe, expect, it } from 'vitest';
import { RepositoryBasedNodeProvider } from '../RepositoryBasedNodeProvider';
import { BlueNode } from '../../model';
import { BlueIdCalculator, NodeToMapListOrValue } from '../../utils';

describe('RepositoryBasedNodeProvider', () => {
  it('does not map historical BlueIds automatically', () => {
    const historicalId = 'old-id';
    const currentId = 'current-id';

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

    const provider = new RepositoryBasedNodeProvider([repository]);

    expect(provider.hasBlueId(historicalId)).toBe(false);
    expect(provider.fetchByBlueId(historicalId)).toBeNull();
    expect(provider.hasBlueId(currentId)).toBe(true);
    const fetched = provider.fetchByBlueId(currentId);
    expect(fetched?.[0]?.getBlueId()).toEqual(currentId);
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

  it('preprocesses repository content using alias mappings', () => {
    const childId = 'child-id';
    const parentId = 'parent-id';

    const typesMeta = {
      [childId]: {
        status: 'stable' as const,
        name: 'Child',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: childId,
            attributesAdded: [],
          },
        ],
      },
      [parentId]: {
        status: 'stable' as const,
        name: 'Parent',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: parentId,
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
          aliases: { 'test/Child': childId, 'test/Parent': parentId },
          typesMeta,
          contents: {
            [childId]: { name: 'Child' },
            [parentId]: {
              name: 'Parent',
              child: {
                type: 'test/Child',
              },
            },
          },
          schemas: {},
        },
      },
    };

    const provider = new RepositoryBasedNodeProvider([repository]);
    const fetched = provider.fetchByBlueId(parentId);
    const childType = fetched
      ? fetched[0]?.getProperties()?.child?.getType()
      : undefined;

    expect(childType?.getBlueId()).toEqual(childId);
  });

  it('preserves # references for multi-document content', () => {
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
    expect(items?.map((n) => n.getBlueId())).toEqual([undefined, undefined]);

    const byIndex = provider.fetchByBlueId(`${listId}#0`);
    expect(byIndex?.[0]?.getBlueId()).toEqual(`${listId}#0`);

    const individualBlueId = BlueIdCalculator.calculateBlueIdSync(first);
    const byIndividual = provider.fetchByBlueId(individualBlueId);
    expect(byIndividual?.[0]?.getBlueId()).toEqual(individualBlueId);

    const byName = provider.findNodeByName('First');
    expect(byName?.getBlueId()).toEqual(`${listId}#0`);
  });
});
