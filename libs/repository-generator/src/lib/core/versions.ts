import { BlueRepositoryDocument, BlueTypeMetadata } from '../types';
import {
  Alias,
  DiscoveredType,
  JsonMap,
  PackageTypeMap,
  TypeName,
  PackageName,
} from './internalTypes';
import { classifyChange, CHANGE_STATUS } from './diff';
import { cloneVersions, isPlainObject } from './utils';
import { BLUE_TYPE_STATUS } from './constants';

export function indexPreviousTypes(
  previous: BlueRepositoryDocument | null,
): PackageTypeMap {
  const map: PackageTypeMap = new Map();
  if (!previous) {
    return map;
  }

  for (const pkg of previous.packages || []) {
    if (typeof pkg.name !== 'string') {
      continue;
    }
    const types = new Map<TypeName, BlueTypeMetadata>();
    for (const type of pkg.types || []) {
      const content = type.content;
      const typeName =
        isPlainObject(content) && typeof content.name === 'string'
          ? content.name
          : undefined;
      if (!typeName) {
        continue;
      }
      types.set(typeName, type);
    }
    map.set(pkg.name, types);
  }

  return map;
}

export function validateStableRemoval(
  discovered: Map<Alias, DiscoveredType>,
  previousTypes: PackageTypeMap,
) {
  for (const [packageName, types] of previousTypes) {
    for (const [typeName, typeMetadata] of types) {
      const alias = `${packageName}/${typeName}` as Alias;
      if (discovered.has(alias)) {
        continue;
      }
      if (typeMetadata.status === BLUE_TYPE_STATUS.Stable) {
        throw new Error(
          `Stable type ${alias} was removed. Breaking changes require a new logical type name.`,
        );
      }
    }
  }
}

interface BuildPackagesArgs {
  discovered: Map<Alias, DiscoveredType>;
  previousTypes: PackageTypeMap;
  aliasToBlueId: Map<Alias, string>;
  aliasToPreprocessed: Map<Alias, JsonMap>;
  nextRepoVersionIndex: number;
}

export function buildPackages({
  discovered,
  previousTypes,
  aliasToBlueId,
  aliasToPreprocessed,
  nextRepoVersionIndex,
}: BuildPackagesArgs): Map<PackageName, BlueTypeMetadata[]> {
  const packages = new Map<PackageName, BlueTypeMetadata[]>();
  const blueIdAliases = buildBlueIdAliasMap(previousTypes, aliasToBlueId);

  for (const [alias, type] of discovered) {
    const blueId = aliasToBlueId.get(alias);
    if (!blueId) {
      throw new Error(`Failed to compute BlueId for type ${alias}.`);
    }

    const previousType =
      previousTypes.get(type.packageName)?.get(type.typeName) ?? null;

    if (
      previousType &&
      previousType.status === BLUE_TYPE_STATUS.Stable &&
      type.status === BLUE_TYPE_STATUS.Dev
    ) {
      throw new Error(
        `Type ${alias} was stable previously and cannot be downgraded to dev. Use a new logical name instead.`,
      );
    }

    const currentContent = aliasToPreprocessed.get(alias) ?? type.content;

    const metadata =
      type.status === BLUE_TYPE_STATUS.Dev
        ? buildDevMetadata({ blueId, nextRepoVersionIndex, previousType })
        : !previousType || previousType.status === BLUE_TYPE_STATUS.Dev
          ? buildNewStableMetadata({ blueId, nextRepoVersionIndex })
          : buildExistingStableMetadata({
              alias,
              blueId,
              nextRepoVersionIndex,
              previousType,
              currentContent,
              packageName: type.packageName,
              typeName: type.typeName,
              blueIdAliases,
            });

    metadata.content = currentContent;
    metadata.status = type.status;

    const pkgTypes = packages.get(type.packageName) ?? [];
    pkgTypes.push(metadata);
    packages.set(type.packageName, pkgTypes);
  }

  return packages;
}

function buildBlueIdAliasMap(
  previousTypes: PackageTypeMap,
  aliasToBlueId: Map<Alias, string>,
): Map<string, Set<Alias>> {
  const map = new Map<string, Set<Alias>>();

  const addAlias = (blueId: string, alias: Alias) => {
    const existing = map.get(blueId);
    if (existing) {
      existing.add(alias);
      return;
    }
    map.set(blueId, new Set([alias]));
  };

  for (const [packageName, types] of previousTypes) {
    for (const [typeName, metadata] of types) {
      const alias = `${packageName}/${typeName}` as Alias;
      for (const version of metadata.versions ?? []) {
        if (typeof version.typeBlueId === 'string') {
          addAlias(version.typeBlueId, alias);
        }
      }
    }
  }

  for (const [alias, blueId] of aliasToBlueId) {
    addAlias(blueId, alias);
  }

  return map;
}

function buildDevMetadata({
  blueId,
  nextRepoVersionIndex,
  previousType,
}: {
  blueId: string;
  nextRepoVersionIndex: number;
  previousType: BlueTypeMetadata | null;
}): BlueTypeMetadata {
  const previousDev =
    previousType && previousType.status === BLUE_TYPE_STATUS.Dev
      ? previousType
      : null;
  const previousDevVersion =
    previousDev?.versions?.length === 1 ? previousDev.versions[0] : null;
  const devUnchanged =
    previousDevVersion && previousDevVersion.typeBlueId === blueId;

  return {
    status: BLUE_TYPE_STATUS.Dev,
    content: {},
    versions:
      devUnchanged && previousDev?.versions
        ? cloneVersions(previousDev.versions)
        : [
            {
              repositoryVersionIndex: nextRepoVersionIndex,
              typeBlueId: blueId,
              attributesAdded: [],
            },
          ],
  };
}

function buildNewStableMetadata({
  blueId,
  nextRepoVersionIndex,
}: {
  blueId: string;
  nextRepoVersionIndex: number;
}): BlueTypeMetadata {
  return {
    status: BLUE_TYPE_STATUS.Stable,
    content: {},
    versions: [
      {
        repositoryVersionIndex: nextRepoVersionIndex,
        typeBlueId: blueId,
        attributesAdded: [],
      },
    ],
  };
}

function buildExistingStableMetadata({
  alias,
  blueId,
  nextRepoVersionIndex,
  previousType,
  currentContent,
  packageName,
  typeName,
  blueIdAliases,
}: {
  alias: Alias;
  blueId: string;
  nextRepoVersionIndex: number;
  previousType: BlueTypeMetadata;
  currentContent: JsonMap;
  packageName: PackageName;
  typeName: TypeName;
  blueIdAliases: Map<string, Set<Alias>>;
}): BlueTypeMetadata {
  if (!isPlainObject(previousType.content)) {
    throw new Error(
      `Type ${alias} has non-object content; cannot compute diff for stable versioning.`,
    );
  }

  const diffResult = classifyChange(
    previousType.content as JsonMap,
    currentContent,
    packageName,
    typeName,
    blueIdAliases,
  );

  if (diffResult.status === CHANGE_STATUS.Unchanged) {
    const versions = cloneVersions(previousType.versions || []);
    const latest = versions.at(-1);
    if (latest && latest.typeBlueId !== blueId) {
      throw new Error(
        `Type ${alias} content is unchanged but BlueId differs from previous metadata.`,
      );
    }
    return {
      status: BLUE_TYPE_STATUS.Stable,
      content: {},
      versions,
    };
  }

  if (diffResult.status === CHANGE_STATUS.NonBreaking) {
    return {
      status: BLUE_TYPE_STATUS.Stable,
      content: {},
      versions: [
        ...cloneVersions(previousType.versions || []),
        {
          repositoryVersionIndex: nextRepoVersionIndex,
          typeBlueId: blueId,
          attributesAdded: diffResult.attributesAdded,
        },
      ],
    };
  }

  throw new Error(
    `Breaking change detected in stable type ${alias}. Introduce a new type name for breaking changes.`,
  );
}
