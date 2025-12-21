import { JsonValue } from '@blue-labs/shared-utils';
import { ZodTypeAny } from 'zod';
import {
  BlueRepository,
  VersionedBlueRepository,
  BlueRepositoryPackage,
  BlueTypeRuntimeMeta,
} from '../types/BlueRepository';
import { validateAttributesAddedPointer as validateAttributesAddedPointerContract } from '@blue-labs/repository-contract';

export interface RegisteredRepositoryRuntime {
  name: string;
  repositoryVersions: readonly string[];
  repoVersionIndexById: Record<string, number>;
  aliases: Record<string, string>;
  types: Record<string, BlueTypeRuntimeMeta>;
  toCurrentBlueIdIndex: Record<string, string>;
  contents: Record<string, JsonValue>;
  schemas: readonly ZodTypeAny[];
  currentRepoBlueId: string;
  typeAliasByCurrentBlueId: Record<string, string>;
  typePackageByCurrentBlueId: Record<string, string>;
}

export class RepositoryRegistry {
  private readonly runtimes: RegisteredRepositoryRuntime[];
  private readonly contents: Record<string, JsonValue>;
  private readonly aliases: Record<string, string>;

  constructor(repositories: BlueRepository[]) {
    const runtimes: RegisteredRepositoryRuntime[] = [];

    for (const repo of repositories) {
      runtimes.push(buildRegisteredRepositoryRuntime(repo));
    }

    this.runtimes = runtimes;

    this.contents = {};
    this.aliases = {};

    for (const runtime of this.runtimes) {
      mergeContentsOrThrow(this.contents, runtime.contents, runtime.name);
      mergeAliasesOrThrow(this.aliases, runtime.aliases, runtime.name);
    }
  }

  public getRuntimes(): RegisteredRepositoryRuntime[] {
    return this.runtimes;
  }

  public getAliases(): Record<string, string> {
    return this.aliases;
  }

  public getContents(): Record<string, JsonValue> {
    return this.contents;
  }

  public findRuntimeByName(
    name: string,
  ): RegisteredRepositoryRuntime | undefined {
    return this.runtimes.find((r) => r.name === name);
  }

  public toCurrentBlueId(blueId: string): string {
    for (const runtime of this.runtimes) {
      const mapped = runtime.toCurrentBlueIdIndex[blueId];
      if (mapped) {
        return mapped;
      }
    }
    return blueId;
  }

  public findRuntimeByBlueId(blueId: string):
    | {
        runtime: RegisteredRepositoryRuntime;
        currentBlueId: string;
        typeMeta: BlueTypeRuntimeMeta | undefined;
        typeAlias?: string;
      }
    | undefined {
    const currentBlueId = this.toCurrentBlueId(blueId);
    for (const runtime of this.runtimes) {
      const typeMeta = runtime.types[currentBlueId];
      if (typeMeta) {
        return {
          runtime,
          currentBlueId,
          typeMeta,
          typeAlias: runtime.typeAliasByCurrentBlueId[currentBlueId],
        };
      }
    }
    return undefined;
  }
}

function buildRegisteredRepositoryRuntime(
  repository: VersionedBlueRepository,
): RegisteredRepositoryRuntime {
  const aliases: Record<string, string> = {};
  const types: Record<string, BlueTypeRuntimeMeta> = {};
  const toCurrentBlueIdIndex: Record<string, string> = {};
  const contents: Record<string, JsonValue> = {};
  const schemas: ZodTypeAny[] = [];
  const typeAliasByCurrentBlueId: Record<string, string> = {};
  const typePackageByCurrentBlueId: Record<string, string> = {};

  const packageNames = new Set<string>();
  const repoVersionIndexById = Object.fromEntries(
    repository.repositoryVersions.map((id, idx) => [id, idx]),
  );

  Object.values(repository.packages).forEach((pkg: BlueRepositoryPackage) => {
    if (packageNames.has(pkg.name)) {
      throw new Error(`Duplicate package name detected: ${pkg.name}`);
    }
    packageNames.add(pkg.name);

    Object.entries(pkg.aliases).forEach(([alias, blueId]) => {
      if (aliases[alias] && aliases[alias] !== blueId) {
        throw new Error(`Conflicting alias mapping for ${alias}`);
      }
      aliases[alias] = blueId;
    });

    const pkgTypesMeta: Record<string, BlueTypeRuntimeMeta> = pkg.typesMeta;

    Object.entries(pkgTypesMeta).forEach(([blueId, meta]) => {
      if (types[blueId]) {
        throw new Error(`Duplicate type mapping for BlueId ${blueId}`);
      }
      const normalizedMeta = normalizeTypeMeta(
        meta,
        repository,
        blueId,
        pkg.name,
      );
      types[blueId] = normalizedMeta;
      typePackageByCurrentBlueId[blueId] = pkg.name;
      typeAliasByCurrentBlueId[blueId] = `${pkg.name}/${meta.name}`;

      if (normalizedMeta.status === 'stable' && !toCurrentBlueIdIndex[blueId]) {
        toCurrentBlueIdIndex[blueId] = blueId;
      }

      if (normalizedMeta.status === 'stable') {
        for (const version of normalizedMeta.versions) {
          const existing = toCurrentBlueIdIndex[version.typeBlueId];
          if (existing && existing !== blueId) {
            throw new Error(
              `Conflicting toCurrentBlueIdIndex mapping for ${version.typeBlueId}`,
            );
          }
          toCurrentBlueIdIndex[version.typeBlueId] = blueId;
        }
      }
    });

    Object.entries(pkg.contents).forEach(([blueId, content]) => {
      contents[blueId] = content;
    });

    schemas.push(...Object.values(pkg.schemas));
  });

  const currentRepoBlueId =
    repository.repositoryVersions[repository.repositoryVersions.length - 1];

  return {
    name: repository.name,
    repositoryVersions: repository.repositoryVersions,
    repoVersionIndexById,
    aliases,
    types,
    toCurrentBlueIdIndex,
    contents,
    schemas,
    currentRepoBlueId,
    typeAliasByCurrentBlueId,
    typePackageByCurrentBlueId,
  };
}

function normalizeTypeMeta(
  meta: BlueTypeRuntimeMeta,
  repository: VersionedBlueRepository,
  currentBlueId: string,
  packageName: string,
): BlueTypeRuntimeMeta {
  if (meta.status === 'dev') {
    validateDevVersions(meta, repository, currentBlueId, packageName);
    return {
      ...meta,
      versions: meta.versions ? [...meta.versions] : meta.versions,
    };
  }

  const versions = [...(meta.versions ?? [])].sort(
    (a, b) => a.repositoryVersionIndex - b.repositoryVersionIndex,
  );

  if (versions.length === 0) {
    throw new Error(
      `Stable type ${packageName}/${meta.name} (${currentBlueId}) must have at least one version entry`,
    );
  }

  const seenIndexes = new Set<number>();
  versions.forEach((version) => {
    if (
      version.repositoryVersionIndex < 0 ||
      version.repositoryVersionIndex >= repository.repositoryVersions.length
    ) {
      throw new Error(
        `Invalid repositoryVersionIndex ${version.repositoryVersionIndex} for ${packageName}/${meta.name}`,
      );
    }
    if (seenIndexes.has(version.repositoryVersionIndex)) {
      throw new Error(
        `Duplicate repositoryVersionIndex ${version.repositoryVersionIndex} for ${packageName}/${meta.name}`,
      );
    }
    seenIndexes.add(version.repositoryVersionIndex);

    for (const pointer of version.attributesAdded ?? []) {
      validateAttributesAddedPointerWithContext(
        pointer,
        repository.name,
        currentBlueId,
        version.repositoryVersionIndex,
      );
    }
  });

  return {
    ...meta,
    versions,
  };
}

function validateDevVersions(
  meta: BlueTypeRuntimeMeta,
  repository: VersionedBlueRepository,
  currentBlueId: string,
  packageName: string,
) {
  if (meta.status !== 'dev') {
    return;
  }
  if (meta.versions && meta.versions.length > 1) {
    throw new Error(
      `Dev type ${packageName}/${meta.name} (${currentBlueId}) must not declare multiple versions`,
    );
  }
  if (meta.versions && meta.versions.length === 1) {
    const version = meta.versions[0];
    if (
      version.repositoryVersionIndex < 0 ||
      version.repositoryVersionIndex >= repository.repositoryVersions.length
    ) {
      throw new Error(
        `Invalid repositoryVersionIndex ${version.repositoryVersionIndex} for dev type ${packageName}/${meta.name}`,
      );
    }
  }
}

function validateAttributesAddedPointerWithContext(
  pointer: string,
  repositoryName: string,
  currentBlueId: string,
  repositoryVersionIndex: number,
) {
  try {
    validateAttributesAddedPointerContract(pointer);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(
      `Invalid attributesAdded pointer '${pointer}' for type ${currentBlueId} in repository ${repositoryName} at index ${repositoryVersionIndex}: ${reason}`,
    );
  }
}

function mergeAliasesOrThrow(
  target: Record<string, string>,
  source: Record<string, string>,
  sourceName: string,
) {
  for (const [alias, blueId] of Object.entries(source)) {
    const existing = target[alias];
    if (existing && existing !== blueId) {
      throw new Error(
        `Conflicting alias '${alias}' across repositories: '${existing}' vs '${blueId}' (from ${sourceName})`,
      );
    }
    target[alias] = blueId;
  }
}

function mergeContentsOrThrow(
  target: Record<string, JsonValue>,
  source: Record<string, JsonValue>,
  sourceName: string,
) {
  for (const [blueId, content] of Object.entries(source)) {
    if (blueId in target) {
      const existing = target[blueId];
      if (!deepEqualJsonValue(existing, content)) {
        throw new Error(
          `Conflicting content for BlueId '${blueId}' across repositories (from ${sourceName})`,
        );
      }
      continue;
    }
    target[blueId] = content;
  }
}

function deepEqualJsonValue(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((v, i) => deepEqualJsonValue(v, b[i] as JsonValue))
    );
  }

  if (
    typeof a === 'object' &&
    a !== null &&
    typeof b === 'object' &&
    b !== null &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const aKeys = Object.keys(a as Record<string, JsonValue>);
    const bKeys = Object.keys(b as Record<string, JsonValue>);
    if (aKeys.length !== bKeys.length) return false;
    aKeys.sort();
    bKeys.sort();
    for (let i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) return false;
    }
    for (const key of aKeys) {
      const av = (a as Record<string, JsonValue>)[key];
      const bv = (b as Record<string, JsonValue>)[key];
      if (!deepEqualJsonValue(av, bv)) return false;
    }
    return true;
  }

  return false;
}
