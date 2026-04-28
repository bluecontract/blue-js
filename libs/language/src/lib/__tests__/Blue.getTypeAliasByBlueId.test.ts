import { describe, expect, it } from 'vitest';
import { Blue } from '../Blue';
import { BlueNode } from '../model';
import type {
  BlueRepository,
  BlueRepositoryPackage,
} from '../types/BlueRepository';
import { BlueIdCalculator } from '../utils';
import { TEXT_TYPE_BLUE_ID } from '../utils/Properties';

type VersionEntry = {
  repositoryVersionIndex: number;
  typeBlueId: string;
  attributesAdded: string[];
};

function stableMeta(
  name: string,
  versions: VersionEntry[],
): BlueRepositoryPackage['typesMeta'][string] {
  return { status: 'stable', name, versions };
}

function buildRepositoryFixture(): {
  repository: BlueRepository;
  currentBlueId: string;
  historicalBlueId: string;
} {
  const currentType = new BlueNode('TypeA');
  const currentBlueId = BlueIdCalculator.calculateBlueIdSync(currentType);
  const historicalBlueId = 'historical-type-id';

  return {
    currentBlueId,
    historicalBlueId,
    repository: {
      name: 'repo.blue',
      repositoryVersions: ['R0', 'R1'],
      packages: {
        pkg: {
          name: 'pkg',
          aliases: { 'pkg/TypeA': currentBlueId },
          typesMeta: {
            [currentBlueId]: stableMeta('TypeA', [
              {
                repositoryVersionIndex: 0,
                typeBlueId: historicalBlueId,
                attributesAdded: [],
              },
              {
                repositoryVersionIndex: 1,
                typeBlueId: currentBlueId,
                attributesAdded: [],
              },
            ]),
          },
          contents: {
            [currentBlueId]: { name: 'TypeA' },
          },
          schemas: {},
        },
      },
    },
  };
}

describe('Blue.getTypeAliasByBlueId', () => {
  it('returns core type alias for a known core BlueId', () => {
    const blue = new Blue();

    expect(blue.getTypeAliasByBlueId(TEXT_TYPE_BLUE_ID)).toEqual('Text');
  });

  it('returns current package alias for a historical repository BlueId', () => {
    const { repository, historicalBlueId } = buildRepositoryFixture();
    const blue = new Blue({ repositories: [repository] });

    expect(blue.getTypeAliasByBlueId(historicalBlueId)).toEqual('pkg/TypeA');
  });

  it('returns undefined for an unknown BlueId', () => {
    const { repository } = buildRepositoryFixture();
    const blue = new Blue({ repositories: [repository] });

    expect(blue.getTypeAliasByBlueId('unknown-blue-id')).toBeUndefined();
  });

  it('returns undefined for empty BlueId input', () => {
    const blue = new Blue();

    expect(blue.getTypeAliasByBlueId(undefined)).toBeUndefined();
    expect(blue.getTypeAliasByBlueId('')).toBeUndefined();
    expect(blue.getTypeAliasByBlueId('   ')).toBeUndefined();
  });
});
