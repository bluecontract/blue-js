import * as path from 'path';
import { GenerateRepositoryOptions, GenerateRepositoryResult } from './types';
import { discoverTypes } from './core/discovery';
import {
  buildDependencyGraph,
  enforceStableToDevRule,
  topoSortComponents,
} from './core/graph';
import { computeBlueIds } from './core/blueIds';
import {
  buildPackages,
  indexPreviousTypes,
  validateStableRemoval,
} from './core/versions';
import {
  finalizePackages,
  computeRepoBlueId,
  composeRepositoryDocument,
} from './core/repoDoc';
import { validateWithContract } from './core/contractValidation';
import { readExistingRepository, serializeRepository } from './core/yaml';

export function generateRepository(
  options: GenerateRepositoryOptions,
): GenerateRepositoryResult {
  const repoRoot = path.resolve(options.repoRoot);
  const blueRepositoryPath = path.resolve(options.blueRepositoryPath);

  const { existingYaml, previous } = readExistingRepository(blueRepositoryPath);

  const discoveredTypes = discoverTypes(repoRoot);
  const previousTypes = indexPreviousTypes(previous);

  validateStableRemoval(discoveredTypes, previousTypes);

  const dependencyGraph = buildDependencyGraph(discoveredTypes);
  const componentOrder = topoSortComponents(dependencyGraph);

  enforceStableToDevRule(dependencyGraph, discoveredTypes);

  const { aliasToBlueId, aliasToStorageContent } = computeBlueIds(
    componentOrder,
    discoveredTypes,
    dependencyGraph,
    previousTypes,
  );

  const nextRepoVersionIndex = previous
    ? previous.repositoryVersions.length
    : 0;

  const packagesMap = buildPackages({
    discovered: discoveredTypes,
    previousTypes,
    aliasToBlueId,
    aliasToStorageContent,
    nextRepoVersionIndex,
  });

  const packages = finalizePackages(packagesMap);
  const currentRepoBlueId =
    previous && packagesAreUnchanged(previous.packages, packages)
      ? (previous.repositoryVersions.at(-1) ?? computeRepoBlueId(packages))
      : computeRepoBlueId(packages);

  const { document, changed } = composeRepositoryDocument(
    packages,
    previous,
    currentRepoBlueId,
  );

  validateWithContract(
    document.packages,
    document.repositoryVersions,
    aliasToBlueId,
  );

  const yaml = serializeRepository(document);

  if (previous && !changed && existingYaml && existingYaml !== yaml) {
    throw new Error(
      'BlueRepository.blue content differs from regenerated output while RepoBlueId is unchanged. Please revert manual edits or rerun in write mode.',
    );
  }

  if (options.verbose) {
    console.info(
      `[repository-generator] RepoBlueId: ${currentRepoBlueId} (${changed ? 'changed' : 'unchanged'})`,
    );
  }

  return {
    document,
    currentRepoBlueId,
    previousRepoBlueId: previous?.repositoryVersions.at(-1),
    changed: changed || !existingYaml,
    yaml,
    existingYaml,
  };
}

function packagesAreUnchanged(
  previousPackages: GenerateRepositoryResult['document']['packages'],
  currentPackages: GenerateRepositoryResult['document']['packages'],
): boolean {
  return JSON.stringify(previousPackages) === JSON.stringify(currentPackages);
}
