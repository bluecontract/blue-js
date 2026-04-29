import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Blue } from '../../Blue';
import type { BlueRepository } from '../../types/BlueRepository';
import { BlueErrorCode } from '../../errors/BlueError';
import {
  getTypeBlueIdAnnotation,
  withTypeBlueId,
} from '../../../schema/annotations';
import {
  reindexRepositoryForSemanticStorage,
  validateRepositorySemanticStorage,
  rewriteAliasMappings,
  rewriteBlueIds,
  rewriteBlueIdWithOptionalIndex,
} from '../SemanticRepositoryReindexer';

describe('SemanticRepositoryReindexer', () => {
  it('reindexes repository keys, aliases, content blueIds, metadata, and schemas', () => {
    const oldChildId = 'OLD_CHILD';
    const oldParentId = 'OLD_PARENT';
    const childSchema = withTypeBlueId(oldChildId)(z.object({}));
    const parentSchema = withTypeBlueId(oldParentId)(z.object({}));
    const repository = repositoryFixture({
      oldChildId,
      oldParentId,
      childSchema,
      parentSchema,
    });

    const reindexed = reindexRepositoryForSemanticStorage(repository);
    const pkg = reindexed.packages.pkg;
    expect(pkg).toBeDefined();

    const childId = pkg.aliases['Pkg/Child'];
    const parentId = pkg.aliases['Pkg/Parent'];
    expect(childId).toBeDefined();
    expect(parentId).toBeDefined();
    expect(childId).not.toBe(oldChildId);
    expect(parentId).not.toBe(oldParentId);

    expect(pkg.contents[childId]).toBeDefined();
    expect(pkg.contents[parentId]).toMatchObject({
      name: 'Parent',
      child: { type: { blueId: childId } },
    });
    expect(pkg.aliases['Pkg/ParentFragment']).toBe(`${parentId}#1`);
    expect(pkg.typesMeta[childId]?.name).toBe('Child');
    expect(pkg.typesMeta[parentId]?.name).toBe('Parent');
    expect(pkg.typesMeta[childId]?.versions[0]?.typeBlueId).toBe(childId);
    expect(pkg.typesMeta[parentId]?.versions[0]?.typeBlueId).toBe(parentId);

    const parentTypeBlueId = getTypeBlueIdAnnotation(pkg.schemas[parentId])
      ?.value?.[0];
    expect(parentTypeBlueId).toBe(parentId);

    expect(() => validateRepositorySemanticStorage(reindexed)).not.toThrow();
    expect(() => new Blue({ repositories: [reindexed] })).not.toThrow();
  });

  it('validates repository content keys against semantic BlueIds', () => {
    const content = { name: 'StrictType' };
    const semanticId = new Blue().calculateBlueIdSync(content);
    const repository: BlueRepository = {
      name: 'strict.repository',
      repositoryVersions: ['R0'],
      packages: {
        pkg: {
          name: 'pkg',
          aliases: { 'Pkg/StrictType': semanticId },
          typesMeta: {
            [semanticId]: {
              status: 'stable',
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
            'wrong-repository-content-id': content,
          },
          schemas: {},
        },
      },
    };

    expect(() => validateRepositorySemanticStorage(repository)).toThrow(
      expect.objectContaining({ code: BlueErrorCode.BLUE_ID_MISMATCH }),
    );
  });

  it('does not reuse the default cache for custom merging processors', () => {
    const repository = repositoryFixture({
      oldChildId: 'CUSTOM_CHILD',
      oldParentId: 'CUSTOM_PARENT',
      childSchema: withTypeBlueId('CUSTOM_CHILD')(z.object({})),
      parentSchema: withTypeBlueId('CUSTOM_PARENT')(z.object({})),
    });

    const defaultResult = reindexRepositoryForSemanticStorage(repository);
    const customResult = reindexRepositoryForSemanticStorage(repository, {
      mergingProcessor: {
        process: (_target, source) => source,
      },
    });

    expect(customResult).not.toBe(defaultResult);
  });

  it('preserves dev type status and empty versions when reindexing metadata', () => {
    const repository: BlueRepository = {
      name: 'dev.repository',
      repositoryVersions: ['R0'],
      packages: {
        pkg: {
          name: 'pkg',
          aliases: {
            'Pkg/Dev': 'OLD_DEV',
          },
          typesMeta: {
            OLD_DEV: {
              status: 'dev',
              name: 'Dev',
              versions: [],
            },
          },
          contents: {
            OLD_DEV: {
              name: 'Dev',
            },
          },
          schemas: {},
        },
      },
    };

    const reindexed = reindexRepositoryForSemanticStorage(repository);
    const newDevId = reindexed.packages.pkg.aliases['Pkg/Dev'];

    expect(newDevId).toBeDefined();
    expect(reindexed.packages.pkg.typesMeta[newDevId]).toMatchObject({
      status: 'dev',
      name: 'Dev',
      versions: [],
    });
    expect(() => new Blue({ repositories: [reindexed] })).not.toThrow();
  });

  it('rewrites indexed type version BlueIds when reindexing metadata', () => {
    const oldListId = 'OLD_LIST';
    const repository: BlueRepository = {
      name: 'indexed.repository',
      repositoryVersions: ['R0'],
      packages: {
        pkg: {
          name: 'pkg',
          aliases: {
            'Pkg/List': oldListId,
            'Pkg/Second': `${oldListId}#1`,
          },
          typesMeta: {
            [oldListId]: {
              status: 'stable',
              name: 'List',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: `${oldListId}#1`,
                  attributesAdded: [],
                },
              ],
            },
          },
          contents: {
            [oldListId]: [{ name: 'First' }, { name: 'Second' }],
          },
          schemas: {},
        },
      },
    };

    const reindexed = reindexRepositoryForSemanticStorage(repository);
    const pkg = reindexed.packages.pkg;
    const listId = pkg.aliases['Pkg/List'];

    expect(listId).toBeDefined();
    expect(pkg.aliases['Pkg/Second']).toBe(`${listId}#1`);
    expect(pkg.typesMeta[listId]?.versions[0]?.typeBlueId).toBe(`${listId}#1`);
    expect(() => validateRepositorySemanticStorage(reindexed)).not.toThrow();
    expect(() => new Blue({ repositories: [reindexed] })).not.toThrow();
  });

  it('validates direct cyclic repository document sets', () => {
    const contents = [
      {
        name: 'RepoA',
        peer: {
          blueId: 'this#1',
        },
      },
      {
        name: 'RepoB',
        peer: {
          blueId: 'this#0',
        },
      },
    ];
    const masterBlueId = new Blue().calculateBlueIdSync(contents);
    const repository: BlueRepository = {
      name: 'cyclic.repository',
      repositoryVersions: ['R0'],
      packages: {
        pkg: {
          name: 'pkg',
          aliases: {
            'Pkg/RepoA': `${masterBlueId}#0`,
            'Pkg/RepoB': `${masterBlueId}#1`,
          },
          typesMeta: {},
          contents: {
            [masterBlueId]: contents,
          },
          schemas: {},
        },
      },
    };

    expect(() => validateRepositorySemanticStorage(repository)).not.toThrow();
  });

  it('reindexes dependency chains deeper than the previous fixed pass cap', () => {
    const chainLength = 12;
    const repository = dependencyChainRepositoryFixture(chainLength);

    const reindexed = reindexRepositoryForSemanticStorage(repository);
    const pkg = reindexed.packages.pkg;
    const firstId = pkg.aliases['Pkg/T0'];
    const lastId = pkg.aliases[`Pkg/T${chainLength - 1}`];

    expect(firstId).toBeDefined();
    expect(lastId).toBeDefined();
    expect(firstId).not.toBe('OLD_0');
    expect(lastId).not.toBe(`OLD_${chainLength - 1}`);
    expect(pkg.contents[firstId]).toBeDefined();
    expect(pkg.contents[lastId]).toBeDefined();
    expect(() => new Blue({ repositories: [reindexed] })).not.toThrow();
  });
});

describe('semantic repository rewrite helpers', () => {
  it('rewrites old repository blueId fragments with #index suffixes', () => {
    expect(
      rewriteBlueIds({ type: { blueId: 'OLD#1' } }, { OLD: 'NEW' }),
    ).toEqual({
      type: { blueId: 'NEW#1' },
    });
  });

  it('prefers exact mappings before indexed suffix rewrites', () => {
    expect(
      rewriteBlueIdWithOptionalIndex('OLD#1', {
        OLD: 'NEW',
        'OLD#1': 'EXACT',
      }),
    ).toBe('EXACT');
  });

  it('rewrites aliases with indexed suffixes', () => {
    expect(rewriteAliasMappings({ Fragment: 'OLD#0' }, { OLD: 'NEW' })).toEqual(
      {
        Fragment: 'NEW#0',
      },
    );
  });
});

function repositoryFixture({
  oldChildId,
  oldParentId,
  childSchema,
  parentSchema,
}: {
  oldChildId: string;
  oldParentId: string;
  childSchema: z.AnyZodObject;
  parentSchema: z.AnyZodObject;
}): BlueRepository {
  return {
    name: 'test.repository',
    repositoryVersions: ['R0'],
    packages: {
      pkg: {
        name: 'pkg',
        aliases: {
          'Pkg/Child': oldChildId,
          'Pkg/Parent': oldParentId,
          'Pkg/ParentFragment': `${oldParentId}#1`,
        },
        typesMeta: {
          [oldChildId]: {
            status: 'stable',
            name: 'Child',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: oldChildId,
                attributesAdded: [],
              },
            ],
          },
          [oldParentId]: {
            status: 'stable',
            name: 'Parent',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: oldParentId,
                attributesAdded: [],
              },
            ],
          },
        },
        contents: {
          [oldChildId]: {
            name: 'Child',
          },
          [oldParentId]: {
            name: 'Parent',
            child: {
              type: {
                blueId: oldChildId,
              },
            },
          },
        },
        schemas: {
          [oldChildId]: childSchema,
          [oldParentId]: parentSchema,
        },
      },
    },
  };
}

function dependencyChainRepositoryFixture(chainLength: number): BlueRepository {
  const aliases: BlueRepository['packages'][string]['aliases'] = {};
  const typesMeta: BlueRepository['packages'][string]['typesMeta'] = {};
  const contents: BlueRepository['packages'][string]['contents'] = {};

  for (let index = 0; index < chainLength; index++) {
    const oldBlueId = `OLD_${index}`;
    const name = `T${index}`;
    aliases[`Pkg/${name}`] = oldBlueId;
    typesMeta[oldBlueId] = {
      status: 'stable',
      name,
      versions: [
        {
          repositoryVersionIndex: 0,
          typeBlueId: oldBlueId,
          attributesAdded: [],
        },
      ],
    };
    contents[oldBlueId] =
      index === chainLength - 1
        ? { name }
        : {
            name,
            child: {
              type: {
                blueId: `OLD_${index + 1}`,
              },
            },
          };
  }

  return {
    name: 'deep.repository',
    repositoryVersions: ['R0'],
    packages: {
      pkg: {
        name: 'pkg',
        aliases,
        typesMeta,
        contents,
        schemas: {},
      },
    },
  };
}
