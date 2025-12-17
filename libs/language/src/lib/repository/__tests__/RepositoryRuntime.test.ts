import { describe, expect, it } from 'vitest';
import { RepositoryRegistry } from '../RepositoryRuntime';
import type { JsonValue } from '@blue-labs/shared-utils';
import type { VersionedBlueRepository } from '../../types/BlueRepository';

describe('RepositoryRegistry', () => {
  it('throws on alias collisions across repositories', () => {
    const repoA = buildRepo(
      'repo-a',
      'id-a',
      { 'pkg/Type': 'id-a' },
      { name: 'A' },
    );
    const repoB = buildRepo(
      'repo-b',
      'id-b',
      { 'pkg/Type': 'id-b' },
      { name: 'B' },
    );

    expect(() => new RepositoryRegistry([repoA, repoB])).toThrowError(
      /Conflicting alias/,
    );
  });

  it('throws on content collisions across repositories', () => {
    const repoA = buildRepo(
      'repo-a',
      'shared-id',
      { 'pkg/A': 'shared-id' },
      { name: 'A' },
    );
    const repoB = buildRepo(
      'repo-b',
      'shared-id',
      { 'pkg/B': 'shared-id' },
      { name: 'B' },
    );

    expect(() => new RepositoryRegistry([repoA, repoB])).toThrowError(
      /Conflicting content/,
    );
  });
});

function buildRepo(
  name: string,
  blueId: string,
  aliases: Record<string, string>,
  content: JsonValue,
): VersionedBlueRepository {
  const typesMeta = {
    [blueId]: {
      status: 'stable' as const,
      name: 'Type',
      versions: [
        { repositoryVersionIndex: 0, typeBlueId: blueId, attributesAdded: [] },
      ],
    },
  };

  return {
    name,
    repositoryVersions: ['R0'],
    packages: {
      pkg: {
        name: 'pkg',
        aliases,
        typesMeta,
        contents: { [blueId]: content },
        schemas: {},
      },
    },
  };
}
