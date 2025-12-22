import { describe, expect, it } from 'vitest';
import { RepositoryRegistry } from '../RepositoryRuntime';
import type {
  BlueRepository,
  BlueRepositoryPackage,
} from '../../types/BlueRepository';
import { TEXT_TYPE_BLUE_ID } from '../../utils/Properties';

type VersionEntry = {
  repositoryVersionIndex: number;
  typeBlueId: string;
  attributesAdded: string[];
};

type PackageInput = {
  name: string;
  aliases?: BlueRepositoryPackage['aliases'];
  typesMeta?: BlueRepositoryPackage['typesMeta'];
  contents?: BlueRepositoryPackage['contents'];
  schemas?: BlueRepositoryPackage['schemas'];
};

function stableMeta(
  name: string,
  versions: VersionEntry[],
): BlueRepositoryPackage['typesMeta'][string] {
  return { status: 'stable' as const, name, versions };
}

function devMeta(
  name: string,
  versions: VersionEntry[] = [],
): BlueRepositoryPackage['typesMeta'][string] {
  return { status: 'dev' as const, name, versions };
}

function buildPackage(input: PackageInput): BlueRepositoryPackage {
  return {
    name: input.name,
    aliases: input.aliases ?? {},
    typesMeta: input.typesMeta ?? {},
    contents: input.contents ?? {},
    schemas: input.schemas ?? {},
  };
}

function buildRepo(options: {
  name: string;
  repositoryVersions?: string[];
  packages: Record<string, BlueRepositoryPackage>;
}): BlueRepository {
  return {
    name: options.name,
    repositoryVersions: options.repositoryVersions ?? ['R0'],
    packages: options.packages,
  };
}

describe('RepositoryRegistry', () => {
  it('builds indexes and resolves aliases for current and historical IDs', () => {
    const repositoryVersions = ['R0', 'R1'];
    const currentId = 'current-id';
    const historicalId = 'historical-id';

    const repository = buildRepo({
      name: 'repo.blue',
      repositoryVersions,
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          aliases: { 'pkg/TypeA': currentId },
          typesMeta: {
            [currentId]: stableMeta('TypeA', [
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
            ]),
          },
          contents: {
            [currentId]: { name: 'TypeA' },
          },
        }),
      },
    });

    const registry = new RepositoryRegistry([repository]);
    const runtime = registry.findRuntimeByName('repo.blue');

    expect(runtime?.repoVersionIndexById).toEqual({ R0: 0, R1: 1 });
    expect(runtime?.currentRepoBlueId).toEqual('R1');
    expect(registry.toCurrentBlueId(historicalId)).toEqual(currentId);
    expect(registry.getTypeAlias(historicalId)).toEqual('pkg/TypeA');

    const resolved = registry.findRuntimeByBlueId(historicalId);
    expect(resolved?.currentBlueId).toEqual(currentId);
    expect(resolved?.typeAlias).toEqual('pkg/TypeA');
    expect(registry.getAliases()['pkg/TypeA']).toEqual(currentId);
    expect(registry.getContents()[currentId]).toEqual({ name: 'TypeA' });
  });

  it('returns core type aliases from primitive BlueIds', () => {
    const repo = buildRepo({
      name: 'repo.core',
      packages: {
        pkg: buildPackage({
          name: 'pkg',
        }),
      },
    });
    const registry = new RepositoryRegistry([repo]);
    expect(registry.getTypeAlias(TEXT_TYPE_BLUE_ID)).toEqual('Text');
  });

  it('allows identical content across repositories', () => {
    const sharedId = 'shared-id';
    const repoA = buildRepo({
      name: 'repo-a',
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          aliases: { 'pkg/A': sharedId },
          typesMeta: {
            [sharedId]: stableMeta('A', [
              { repositoryVersionIndex: 0, typeBlueId: sharedId, attributesAdded: [] },
            ]),
          },
          contents: {
            [sharedId]: { a: 1, b: 2 },
          },
        }),
      },
    });
    const repoB = buildRepo({
      name: 'repo-b',
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          aliases: { 'pkg/B': sharedId },
          typesMeta: {
            [sharedId]: stableMeta('B', [
              { repositoryVersionIndex: 0, typeBlueId: sharedId, attributesAdded: [] },
            ]),
          },
          contents: {
            [sharedId]: { b: 2, a: 1 },
          },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repoA, repoB])).not.toThrow();
  });

  it('throws on alias collisions across repositories', () => {
    const repoA = buildRepo({
      name: 'repo-a',
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          aliases: { 'pkg/Type': 'id-a' },
          typesMeta: {
            'id-a': stableMeta('A', [
              { repositoryVersionIndex: 0, typeBlueId: 'id-a', attributesAdded: [] },
            ]),
          },
          contents: { 'id-a': { name: 'A' } },
        }),
      },
    });
    const repoB = buildRepo({
      name: 'repo-b',
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          aliases: { 'pkg/Type': 'id-b' },
          typesMeta: {
            'id-b': stableMeta('B', [
              { repositoryVersionIndex: 0, typeBlueId: 'id-b', attributesAdded: [] },
            ]),
          },
          contents: { 'id-b': { name: 'B' } },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repoA, repoB])).toThrowError(
      /Conflicting alias/,
    );
  });

  it('throws on content collisions across repositories', () => {
    const repoA = buildRepo({
      name: 'repo-a',
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          aliases: { 'pkg/A': 'shared-id' },
          typesMeta: {
            'shared-id': stableMeta('A', [
              { repositoryVersionIndex: 0, typeBlueId: 'shared-id', attributesAdded: [] },
            ]),
          },
          contents: { 'shared-id': { name: 'A' } },
        }),
      },
    });
    const repoB = buildRepo({
      name: 'repo-b',
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          aliases: { 'pkg/B': 'shared-id' },
          typesMeta: {
            'shared-id': stableMeta('B', [
              { repositoryVersionIndex: 0, typeBlueId: 'shared-id', attributesAdded: [] },
            ]),
          },
          contents: { 'shared-id': { name: 'B' } },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repoA, repoB])).toThrowError(
      /Conflicting content/,
    );
  });

  it('throws on duplicate package names', () => {
    const repository = buildRepo({
      name: 'repo-dup',
      packages: {
        a: buildPackage({
          name: 'dup',
        }),
        b: buildPackage({
          name: 'dup',
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).toThrowError(
      /Duplicate package name/,
    );
  });

  it('throws on alias collisions inside a repository', () => {
    const repository = buildRepo({
      name: 'repo',
      packages: {
        one: buildPackage({
          name: 'one',
          aliases: { 'pkg/Type': 'id-a' },
        }),
        two: buildPackage({
          name: 'two',
          aliases: { 'pkg/Type': 'id-b' },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).toThrowError(
      /Conflicting alias mapping/,
    );
  });

  it('throws on duplicate type mapping across packages', () => {
    const repository = buildRepo({
      name: 'repo',
      packages: {
        a: buildPackage({
          name: 'a',
          typesMeta: {
            shared: stableMeta('Type', [
              { repositoryVersionIndex: 0, typeBlueId: 'shared', attributesAdded: [] },
            ]),
          },
        }),
        b: buildPackage({
          name: 'b',
          typesMeta: {
            shared: stableMeta('Other', [
              { repositoryVersionIndex: 0, typeBlueId: 'shared', attributesAdded: [] },
            ]),
          },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).toThrowError(
      /Duplicate type mapping/,
    );
  });

  it('throws on stable type with no versions', () => {
    const repository = buildRepo({
      name: 'repo',
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          typesMeta: {
            id: { status: 'stable', name: 'Type', versions: [] },
          },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).toThrowError(
      /must have at least one version entry/,
    );
  });

  it('throws on duplicate repositoryVersionIndex', () => {
    const repository = buildRepo({
      name: 'repo',
      repositoryVersions: ['R0', 'R1'],
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          typesMeta: {
            id: stableMeta('Type', [
              { repositoryVersionIndex: 0, typeBlueId: 'id', attributesAdded: [] },
              { repositoryVersionIndex: 0, typeBlueId: 'id-dup', attributesAdded: [] },
            ]),
          },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).toThrowError(
      /Duplicate repositoryVersionIndex/,
    );
  });

  it('throws on invalid repositoryVersionIndex', () => {
    const repository = buildRepo({
      name: 'repo',
      repositoryVersions: ['R0'],
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          typesMeta: {
            id: stableMeta('Type', [
              { repositoryVersionIndex: 2, typeBlueId: 'id', attributesAdded: [] },
            ]),
          },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).toThrowError(
      /Invalid repositoryVersionIndex/,
    );
  });

  it('throws on invalid attributesAdded pointer', () => {
    const repository = buildRepo({
      name: 'repo',
      repositoryVersions: ['R0'],
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          typesMeta: {
            id: stableMeta('Type', [
              { repositoryVersionIndex: 0, typeBlueId: 'id', attributesAdded: ['/type'] },
            ]),
          },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).toThrowError(
      /Invalid attributesAdded pointer/,
    );
  });

  it('throws on dev type with multiple versions', () => {
    const repository = buildRepo({
      name: 'repo',
      repositoryVersions: ['R0', 'R1'],
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          typesMeta: {
            id: devMeta('Type', [
              { repositoryVersionIndex: 0, typeBlueId: 'id', attributesAdded: [] },
              { repositoryVersionIndex: 1, typeBlueId: 'id2', attributesAdded: [] },
            ]),
          },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).toThrowError(
      /must not declare multiple versions/,
    );
  });

  it('throws on dev type with invalid version index', () => {
    const repository = buildRepo({
      name: 'repo',
      repositoryVersions: ['R0'],
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          typesMeta: {
            id: devMeta('Type', [
              { repositoryVersionIndex: 2, typeBlueId: 'id', attributesAdded: [] },
            ]),
          },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).toThrowError(
      /Invalid repositoryVersionIndex/,
    );
  });

  it('accepts dev type with a single valid version', () => {
    const repository = buildRepo({
      name: 'repo',
      repositoryVersions: ['R0'],
      packages: {
        pkg: buildPackage({
          name: 'pkg',
          typesMeta: {
            id: devMeta('Type', [
              { repositoryVersionIndex: 0, typeBlueId: 'id', attributesAdded: [] },
            ]),
          },
        }),
      },
    });

    expect(() => new RepositoryRegistry([repository])).not.toThrow();
  });
});
