import { describe, expect, it } from 'vitest';
import { RepositoryBasedNodeProvider } from '../RepositoryBasedNodeProvider';
import { BasicNodeProvider } from '../BasicNodeProvider';
import { BlueNode } from '../../model';
import { BlueIdCalculator, NodeToMapListOrValue } from '../../utils';
import { BlueErrorCode } from '../../errors/BlueError';
import { Blue } from '../../Blue';

describe('RepositoryBasedNodeProvider', () => {
  it('does not map historical BlueIds automatically', () => {
    const historicalId = 'old-id';
    const typeNode = new BlueNode('TestType');
    const currentId = BlueIdCalculator.calculateBlueIdSync(typeNode);
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
    expect(fetched?.[0]?.getBlueId()).toBeUndefined();
  });

  it('does not expose historical version BlueIds as repository storage keys', () => {
    const historicalId = 'historical-type-id';
    const typeNode = new BlueNode('VersionedType');
    const currentId = BlueIdCalculator.calculateBlueIdSync(typeNode);
    const repository = {
      name: 'test.repo',
      repositoryVersions: ['R0', 'R1'],
      packages: {
        test: {
          name: 'test',
          aliases: { 'test/VersionedType': currentId },
          typesMeta: {
            [currentId]: {
              status: 'stable' as const,
              name: 'VersionedType',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: historicalId,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: currentId,
                  attributesAdded: [],
                },
              ],
            },
          },
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
  });

  it('rejects repository content keys that do not match semantic BlueIds', () => {
    const typeNode = new BlueNode('StrictType');
    const semanticId = BlueIdCalculator.calculateBlueIdSync(typeNode);
    const wrongId = 'wrong-repository-content-id';
    const repository = {
      name: 'test.repo',
      repositoryVersions: ['R0'],
      packages: {
        test: {
          name: 'test',
          aliases: { 'test/StrictType': semanticId },
          typesMeta: {
            [semanticId]: {
              status: 'stable' as const,
              name: 'StrictType',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: semanticId,
                  attributesAdded: [],
                },
              ],
            },
          },
          contents: {
            [wrongId]: NodeToMapListOrValue.get(typeNode),
          },
          schemas: {},
        },
      },
    };

    expect(() => new RepositoryBasedNodeProvider([repository])).toThrow(
      expect.objectContaining({ code: BlueErrorCode.BLUE_ID_MISMATCH }),
    );
  });

  it('indexes names for new-style repositories', () => {
    const typeNode = new BlueNode('NamedType');
    const typeId = BlueIdCalculator.calculateBlueIdSync(typeNode);
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
    expect(found?.getBlueId()).toBeUndefined();
  });

  it('preprocesses repository content using alias mappings', () => {
    const childNode = new BlueNode('Child');
    const childId = BlueIdCalculator.calculateBlueIdSync(childNode);
    const parentNode = new BlueNode('Parent').setProperties({
      child: new BlueNode().setType(new BlueNode().setBlueId(childId)),
    });
    const parentId = BlueIdCalculator.calculateBlueIdSync(parentNode);

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
            [childId]: NodeToMapListOrValue.get(childNode),
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
    const first = new BlueNode('First');
    const second = new BlueNode('Second');
    const listId = BlueIdCalculator.calculateBlueIdSync([first, second]);
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
    expect(byIndex?.[0]?.getBlueId()).toBeUndefined();

    const individualBlueId = BlueIdCalculator.calculateBlueIdSync(first);
    const byIndividual = provider.fetchByBlueId(individualBlueId);
    expect(byIndividual?.[0]?.getBlueId()).toBeUndefined();

    const byName = provider.findNodeByName('First');
    expect(byName?.getBlueId()).toBeUndefined();
  });

  it('loads direct cyclic repository document sets under MASTER#i ids', () => {
    const first = new BlueNode('RepoA').addProperty(
      'peer',
      new BlueNode().setReferenceBlueId('this#1'),
    );
    const second = new BlueNode('RepoB').addProperty(
      'peer',
      new BlueNode().setReferenceBlueId('this#0'),
    );
    const nodes = [first, second];
    const masterBlueId = new Blue().calculateBlueIdSync(nodes);
    const repository = {
      name: 'test.repo',
      repositoryVersions: ['R0'],
      packages: {
        test: {
          name: 'test',
          aliases: {},
          typesMeta: {},
          contents: {
            [masterBlueId]: nodes.map((node) => NodeToMapListOrValue.get(node)),
          },
          schemas: {},
        },
      },
    };

    const provider = new RepositoryBasedNodeProvider([repository]);
    const fetchedSet = provider.fetchByBlueId(masterBlueId) ?? [];
    const repoAIndex = fetchedSet.findIndex(
      (node) => node.getName() === 'RepoA',
    );
    const repoBIndex = fetchedSet.findIndex(
      (node) => node.getName() === 'RepoB',
    );
    const repoABlueId = `${masterBlueId}#${repoAIndex}`;
    const repoBBlueId = `${masterBlueId}#${repoBIndex}`;

    expect(repoAIndex).toBeGreaterThanOrEqual(0);
    expect(repoBIndex).toBeGreaterThanOrEqual(0);
    expect(repoABlueId.split('#')[0]).toBe(masterBlueId);
    expect(repoBBlueId.split('#')[0]).toBe(masterBlueId);
    expect(provider.findNodeByName('RepoA')?.get('/peer/blueId')).toBe(
      repoBBlueId,
    );
    expect(provider.findNodeByName('RepoB')?.get('/peer/blueId')).toBe(
      repoABlueId,
    );
  });

  it('uses multi-document this rules for singleton arrays during bootstrap', () => {
    const loop = new BlueNode('SingletonLoop').addProperty(
      'self',
      new BlueNode().setReferenceBlueId('this#0'),
    );
    const loopSet = [loop];
    const loopSetBlueId = new Blue().calculateBlueIdSync(loopSet);
    const calculationProvider = new BasicNodeProvider();
    calculationProvider.processNodeList(loopSet);

    const consumer = new BlueNode('SingletonLoopConsumer').setType(
      new BlueNode().setBlueId(loopSetBlueId),
    );
    const consumerBlueId = new Blue({
      nodeProvider: calculationProvider,
    }).calculateBlueIdSync(consumer);
    const repository = {
      name: 'test.repo',
      repositoryVersions: ['R0'],
      packages: {
        test: {
          name: 'test',
          aliases: {},
          typesMeta: {},
          contents: {
            [consumerBlueId]: NodeToMapListOrValue.get(consumer),
            [loopSetBlueId]: loopSet.map((node) =>
              NodeToMapListOrValue.get(node),
            ),
          },
          schemas: {},
        },
      },
    };

    const provider = new RepositoryBasedNodeProvider([repository]);

    expect(provider.findNodeByName('SingletonLoop')?.get('/self/blueId')).toBe(
      `${loopSetBlueId}#0`,
    );
    expect(provider.fetchByBlueId(consumerBlueId)?.[0]?.getName()).toBe(
      'SingletonLoopConsumer',
    );
  });
});
