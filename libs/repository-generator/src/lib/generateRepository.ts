import * as path from 'path';
import * as fs from 'fs';
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
import { verifyGeneratorRegistries } from './core/registry';
import {
  buildProviderBundle,
  serializeProviderBundle,
} from './core/providerBundle';

export function generateRepository(
  options: GenerateRepositoryOptions,
): GenerateRepositoryResult {
  const repoRoot = path.resolve(options.repoRoot);
  const blueRepositoryPath = path.resolve(options.blueRepositoryPath);
  const providerBundlePath = path.resolve(
    options.providerBundlePath ??
      blueRepositoryPath.replace(/\.blue$/i, '.provider.json'),
  );
  const registryPackageIdentities = verifyGeneratorRegistries({
    languageRegistryPath: options.languageRegistryPath,
    contractsRegistryPath: options.contractsRegistryPath,
  });

  const { existingYaml, previous } = readExistingRepository(blueRepositoryPath);

  const discoveredTypes = discoverTypes(repoRoot);
  const previousTypes = indexPreviousTypes(previous);

  validateStableRemoval(discoveredTypes, previousTypes);

  const dependencyGraph = buildDependencyGraph(discoveredTypes);
  const componentOrder = topoSortComponents(dependencyGraph);

  enforceStableToDevRule(dependencyGraph, discoveredTypes);

  const { aliasToBlueId, aliasToStorageContent, aliasToProviderContent } =
    computeBlueIds(
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
  const currentRepoBlueId = computeRepoBlueId(packages);
  const providerBundle = buildProviderBundle(
    currentRepoBlueId,
    registryPackageIdentities,
    aliasToBlueId,
    aliasToProviderContent,
  );
  const providerBundleJson = serializeProviderBundle(providerBundle);
  const existingProviderBundleJson = fs.existsSync(providerBundlePath)
    ? fs.readFileSync(providerBundlePath, 'utf8')
    : undefined;
  if (previous && packagesAreUnchanged(previous.packages, packages)) {
    const previousRepoBlueId = previous.repositoryVersions.at(-1);
    if (
      previousRepoBlueId !== undefined &&
      previousRepoBlueId !== currentRepoBlueId
    ) {
      throw new Error(
        `Stored repository content calculates to ${currentRepoBlueId}, not preserved RepoBlueId ${previousRepoBlueId}.`,
      );
    }
  }

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
  const fileMatches = existingYaml !== undefined && existingYaml === yaml;

  if (options.verbose) {
    console.info(
      `[repository-generator] Language registry: ${registryPackageIdentities.language}`,
    );
    console.info(
      `[repository-generator] Contracts registry: ${registryPackageIdentities.contracts}`,
    );
    console.info(
      `[repository-generator] RepoBlueId: ${currentRepoBlueId} (${changed ? 'changed' : 'unchanged'})`,
    );
  }

  return {
    document,
    currentRepoBlueId,
    previousRepoBlueId: previous?.repositoryVersions.at(-1),
    changed: changed || !fileMatches,
    yaml,
    existingYaml,
    providerBundle,
    providerBundleJson,
    existingProviderBundleJson,
    providerBundleChanged: existingProviderBundleJson !== providerBundleJson,
    registryPackageIdentities,
  };
}

function packagesAreUnchanged(
  previousPackages: GenerateRepositoryResult['document']['packages'],
  currentPackages: GenerateRepositoryResult['document']['packages'],
): boolean {
  return JSON.stringify(previousPackages) === JSON.stringify(currentPackages);
}
