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
import {
  BLUE_TYPE_STATUS,
  PRIMITIVE_BLUE_IDS,
  PRIMITIVE_TYPES,
} from './constants';
import { canonicalizeRepositoryStorageMap } from './repositoryContent';
import type { JsonValue } from '@blue-labs/shared-utils';

const TYPE_CONTROL_KEYS = new Set(['type', 'itemType', 'keyType', 'valueType']);
const CURRENT_EXTERNAL_TYPE_NAME_BY_BLUE_ID = new Map(
  Object.entries(PRIMITIVE_BLUE_IDS).map(([name, blueId]) => [blueId, name]),
);

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
      types.set(typeName, { ...type, content });
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
  aliasToStorageContent: Map<Alias, JsonMap>;
  nextRepoVersionIndex: number;
}

export function buildPackages({
  discovered,
  previousTypes,
  aliasToBlueId,
  aliasToStorageContent,
  nextRepoVersionIndex,
}: BuildPackagesArgs): Map<PackageName, BlueTypeMetadata[]> {
  const packages = new Map<PackageName, BlueTypeMetadata[]>();
  const blueIdAliases = buildBlueIdAliasMap(previousTypes, aliasToBlueId);
  const previousExternalTypeBlueIdsByName = inferPreviousExternalTypeBindings(
    discovered,
    previousTypes,
  );

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

    const currentContent = aliasToStorageContent.get(alias) ?? type.content;

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
              sourceContent: type.content,
              previousExternalTypeBlueIdsByName,
            });

    metadata.content = currentContent;
    metadata.status = type.status;

    const pkgTypes = packages.get(type.packageName) ?? [];
    pkgTypes.push(metadata);
    packages.set(type.packageName, pkgTypes);
  }

  return packages;
}

export function inferPreviousExternalTypeBindings(
  discovered: Map<Alias, DiscoveredType>,
  previousTypes: PackageTypeMap,
): ReadonlyMap<string, string> {
  const blueIdByName = new Map<string, string>();
  const nameByBlueId = new Map<string, string>();

  for (const type of discovered.values()) {
    const previousType = previousTypes
      .get(type.packageName)
      ?.get(type.typeName);
    if (!previousType || !isPlainObject(previousType.content)) {
      continue;
    }
    const previousContent = canonicalizeRepositoryStorageMap(
      previousType.content as JsonMap,
    );
    for (const reference of collectExternalTypeReferences(type.content)) {
      const previousBlueId = readReferencedBlueId(
        getValueAt(previousContent, reference.path),
      );
      if (!previousBlueId) {
        continue;
      }
      const currentOwner =
        CURRENT_EXTERNAL_TYPE_NAME_BY_BLUE_ID.get(previousBlueId);
      if (currentOwner !== undefined && currentOwner !== reference.name) {
        continue;
      }

      const existingBlueId = blueIdByName.get(reference.name);
      const existingName = nameByBlueId.get(previousBlueId);
      if (
        (existingBlueId && existingBlueId !== previousBlueId) ||
        (existingName && existingName !== reference.name)
      ) {
        throw new Error(
          `Cannot safely infer previous registry binding for ${reference.name}; repository source and prior content are inconsistent.`,
        );
      }
      blueIdByName.set(reference.name, previousBlueId);
      nameByBlueId.set(previousBlueId, reference.name);
    }
  }

  return blueIdByName;
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
  sourceContent,
  previousExternalTypeBlueIdsByName,
}: {
  alias: Alias;
  blueId: string;
  nextRepoVersionIndex: number;
  previousType: BlueTypeMetadata;
  currentContent: JsonMap;
  packageName: PackageName;
  typeName: TypeName;
  blueIdAliases: Map<string, Set<Alias>>;
  sourceContent: JsonMap;
  previousExternalTypeBlueIdsByName: ReadonlyMap<string, string>;
}): BlueTypeMetadata {
  if (!isPlainObject(previousType.content)) {
    throw new Error(
      `Type ${alias} has non-object content; cannot compute diff for stable versioning.`,
    );
  }

  const previousContent = canonicalizeRepositoryStorageMap(
    previousType.content as JsonMap,
  );
  const diffResult = classifyChange(
    previousContent,
    currentContent,
    packageName,
    typeName,
    blueIdAliases,
    sourceContent,
    previousExternalTypeBlueIdsByName,
    previousType.versions?.at(-1)?.typeBlueId,
    blueId,
  );

  if (diffResult.status === CHANGE_STATUS.Unchanged) {
    const versions = cloneVersions(previousType.versions || []);
    const latest = versions.at(-1);
    if (latest && latest.typeBlueId !== blueId) {
      return {
        status: BLUE_TYPE_STATUS.Stable,
        content: {},
        versions: [
          ...versions,
          {
            repositoryVersionIndex: nextRepoVersionIndex,
            typeBlueId: blueId,
            attributesAdded: [],
          },
        ],
      };
    }
    return {
      status: BLUE_TYPE_STATUS.Stable,
      content: {},
      versions,
    };
  }

  if (diffResult.status === CHANGE_STATUS.NonBreaking) {
    const versions = cloneVersions(previousType.versions || []);
    if (versions.at(-1)?.typeBlueId === blueId) {
      return {
        status: BLUE_TYPE_STATUS.Stable,
        content: {},
        versions,
      };
    }
    return {
      status: BLUE_TYPE_STATUS.Stable,
      content: {},
      versions: [
        ...versions,
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

function collectExternalTypeReferences(
  content: JsonValue,
): Array<{ name: string; path: string[] }> {
  const references: Array<{ name: string; path: string[] }> = [];

  const visit = (value: JsonValue, path: string[]) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        visit(item as JsonValue, [...path, String(index)]),
      );
      return;
    }
    if (!isPlainObject(value)) {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (
        TYPE_CONTROL_KEYS.has(key) &&
        typeof child === 'string' &&
        PRIMITIVE_TYPES.has(child)
      ) {
        if (PRIMITIVE_BLUE_IDS[child] === undefined) {
          throw new Error(`Missing current registry BlueId for ${child}.`);
        }
        references.push({ name: child, path: [...path, key] });
      }
      visit(child as JsonValue, [...path, key]);
    }
  };

  visit(content, []);
  return references;
}

function getValueAt(
  content: JsonValue,
  segments: readonly string[],
): JsonValue | undefined {
  let current: JsonValue = content;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index] as JsonValue;
      continue;
    }
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[segment] as JsonValue;
  }
  return current;
}

function readReferencedBlueId(value: JsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return isPlainObject(value) && typeof value.blueId === 'string'
    ? value.blueId
    : null;
}
