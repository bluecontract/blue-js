import { JsonValue } from '@blue-labs/shared-utils';
import { ZodTypeAny } from 'zod';
import {
  BlueRepository,
  BlueRepositoryPackage,
  BlueTypeRuntimeMeta,
} from '../types/BlueRepository';
import {
  BLUE_REPOSITORY_STATUS_DEV,
  BLUE_REPOSITORY_STATUS_STABLE,
  validateAttributesAddedPointer as validateAttributesAddedPointerContract,
} from '@blue-labs/repository-contract';
import { CORE_TYPE_BLUE_ID_TO_NAME_MAP } from '../utils/Properties';
import { JsonCanonicalizer } from '../utils/JsonCanonicalizer';

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

  public getTypeAlias(blueId: string): string | undefined {
    const currentBlueId = this.toCurrentBlueId(blueId);
    const coreName = (CORE_TYPE_BLUE_ID_TO_NAME_MAP as Record<string, string>)[
      currentBlueId
    ];
    if (coreName) {
      return coreName;
    }

    for (const runtime of this.runtimes) {
      const alias = runtime.typeAliasByCurrentBlueId[currentBlueId];
      if (alias) {
        return alias;
      }
    }

    return undefined;
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
  repository: BlueRepository,
): RegisteredRepositoryRuntime {
  const state = createRuntimeState(repository);

  Object.values(repository.packages).forEach((pkg: BlueRepositoryPackage) => {
    registerPackage(state, repository, pkg);
  });

  return {
    name: repository.name,
    repositoryVersions: repository.repositoryVersions,
    repoVersionIndexById: state.repoVersionIndexById,
    aliases: state.aliases,
    types: state.types,
    toCurrentBlueIdIndex: state.toCurrentBlueIdIndex,
    contents: state.contents,
    schemas: state.schemas,
    currentRepoBlueId: state.currentRepoBlueId,
    typeAliasByCurrentBlueId: state.typeAliasByCurrentBlueId,
    typePackageByCurrentBlueId: state.typePackageByCurrentBlueId,
  };
}

type RuntimeState = {
  aliases: Record<string, string>;
  types: Record<string, BlueTypeRuntimeMeta>;
  toCurrentBlueIdIndex: Record<string, string>;
  contents: Record<string, JsonValue>;
  schemas: ZodTypeAny[];
  typeAliasByCurrentBlueId: Record<string, string>;
  typePackageByCurrentBlueId: Record<string, string>;
  packageNames: Set<string>;
  repoVersionIndexById: Record<string, number>;
  currentRepoBlueId: string;
};

function createRuntimeState(repository: BlueRepository): RuntimeState {
  const repoVersionIndexById = Object.fromEntries(
    repository.repositoryVersions.map((id, idx) => [id, idx]),
  );
  const currentRepoBlueId =
    repository.repositoryVersions[repository.repositoryVersions.length - 1];

  return {
    aliases: {},
    types: {},
    toCurrentBlueIdIndex: {},
    contents: {},
    schemas: [],
    typeAliasByCurrentBlueId: {},
    typePackageByCurrentBlueId: {},
    packageNames: new Set<string>(),
    repoVersionIndexById,
    currentRepoBlueId,
  };
}

function registerPackage(
  state: RuntimeState,
  repository: BlueRepository,
  pkg: BlueRepositoryPackage,
) {
  if (state.packageNames.has(pkg.name)) {
    throw new Error(`Duplicate package name detected: ${pkg.name}`);
  }
  state.packageNames.add(pkg.name);

  registerAliases(state, pkg);
  registerTypesMeta(state, repository, pkg);
  registerContents(state, pkg);
  registerSchemas(state, pkg);
}

function registerAliases(state: RuntimeState, pkg: BlueRepositoryPackage) {
  Object.entries(pkg.aliases).forEach(([alias, blueId]) => {
    if (state.aliases[alias] && state.aliases[alias] !== blueId) {
      throw new Error(`Conflicting alias mapping for ${alias}`);
    }
    state.aliases[alias] = blueId;
  });
}

function registerTypesMeta(
  state: RuntimeState,
  repository: BlueRepository,
  pkg: BlueRepositoryPackage,
) {
  Object.entries(pkg.typesMeta).forEach(([blueId, meta]) => {
    if (state.types[blueId]) {
      throw new Error(`Duplicate type mapping for BlueId ${blueId}`);
    }

    const normalizedMeta = normalizeTypeMeta(
      meta,
      repository,
      blueId,
      pkg.name,
    );
    state.types[blueId] = normalizedMeta;
    state.typePackageByCurrentBlueId[blueId] = pkg.name;
    state.typeAliasByCurrentBlueId[blueId] = `${pkg.name}/${meta.name}`;

    if (
      normalizedMeta.status === BLUE_REPOSITORY_STATUS_STABLE &&
      !state.toCurrentBlueIdIndex[blueId]
    ) {
      state.toCurrentBlueIdIndex[blueId] = blueId;
    }

    if (normalizedMeta.status === BLUE_REPOSITORY_STATUS_STABLE) {
      for (const version of normalizedMeta.versions) {
        const existing = state.toCurrentBlueIdIndex[version.typeBlueId];
        if (existing && existing !== blueId) {
          throw new Error(
            `Conflicting toCurrentBlueIdIndex mapping for ${version.typeBlueId}`,
          );
        }
        state.toCurrentBlueIdIndex[version.typeBlueId] = blueId;
      }
    }
  });
}

function registerContents(state: RuntimeState, pkg: BlueRepositoryPackage) {
  Object.entries(pkg.contents).forEach(([blueId, content]) => {
    state.contents[blueId] = content;
  });
}

function registerSchemas(state: RuntimeState, pkg: BlueRepositoryPackage) {
  state.schemas.push(...Object.values(pkg.schemas));
}

function normalizeTypeMeta(
  meta: BlueTypeRuntimeMeta,
  repository: BlueRepository,
  currentBlueId: string,
  packageName: string,
): BlueTypeRuntimeMeta {
  if (meta.status === BLUE_REPOSITORY_STATUS_DEV) {
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
  repository: BlueRepository,
  currentBlueId: string,
  packageName: string,
) {
  if (meta.status !== BLUE_REPOSITORY_STATUS_DEV) {
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

  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const canonicalA = JsonCanonicalizer.canonicalize(a);
  const canonicalB = JsonCanonicalizer.canonicalize(b);
  return canonicalA !== undefined && canonicalA === canonicalB;
}
