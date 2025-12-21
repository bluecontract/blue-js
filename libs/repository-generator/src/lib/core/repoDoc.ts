import { BlueIdCalculator } from '@blue-labs/language';
import { BluePackage, BlueRepositoryDocument } from '../types';
import { BLUE_REPOSITORY_NAME } from './constants';
import { PackageName } from './internalTypes';
import { isPlainObject } from './utils';

type BlueIdInput = Parameters<typeof BlueIdCalculator.INSTANCE.calculateSync>[0];

export function finalizePackages(
  packages: Map<PackageName, BluePackage['types']>,
): BluePackage[] {
  return Array.from(packages.entries())
    .map<BluePackage>(([name, types]) => ({
      name,
      types: types
        .map((t) => ({
          ...t,
          versions: [...t.versions].sort(
            (a, b) => a.repositoryVersionIndex - b.repositoryVersionIndex,
          ),
        }))
        .sort((a, b) => {
          const nameA =
            isPlainObject(a.content) && typeof a.content.name === 'string'
              ? a.content.name
              : '';
          const nameB =
            isPlainObject(b.content) && typeof b.content.name === 'string'
              ? b.content.name
              : '';
          return nameA.localeCompare(nameB);
        }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function computeRepoBlueId(packages: BluePackage[]): string {
  return BlueIdCalculator.INSTANCE.calculateSync(
    packages as unknown as BlueIdInput,
  );
}

export function composeRepositoryDocument(
  packages: BluePackage[],
  previous: BlueRepositoryDocument | null,
  currentRepoBlueId: string,
): { document: BlueRepositoryDocument; changed: boolean } {
  const previousRepoBlueId = previous?.repositoryVersions.at(-1);
  const changed =
    !previousRepoBlueId || previousRepoBlueId !== currentRepoBlueId;

  const repositoryVersions = previous?.repositoryVersions
    ? [...previous.repositoryVersions]
    : [];
  if (changed) {
    repositoryVersions.push(currentRepoBlueId);
  }

  const document: BlueRepositoryDocument = {
    name: BLUE_REPOSITORY_NAME,
    packages,
    repositoryVersions,
  };

  return { document, changed };
}
