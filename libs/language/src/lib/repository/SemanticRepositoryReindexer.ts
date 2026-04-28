import type { JsonValue } from '@blue-labs/shared-utils';
import { Blue } from '../Blue';
import { BlueNode } from '../model';
import type { MergingProcessor } from '../merge/MergingProcessor';
import { createDefaultMergingProcessor } from '../merge';
import type { BlueRepository } from '../types/BlueRepository';
import { withTypeBlueId } from '../../schema/annotations';

interface RepositoryEntry {
  packageName: string;
  oldBlueId: string;
  content: JsonValue;
}

export interface SemanticRepositoryReindexOptions {
  mergingProcessor?: MergingProcessor;
}

type RepositoryPackage = BlueRepository['packages'][string];
type TypeBlueIdSchema = Parameters<ReturnType<typeof withTypeBlueId>>[0];

const DEFAULT_REINDEX_CACHE = new WeakMap<BlueRepository, BlueRepository>();
const MAX_REINDEX_PASSES = 10;

export function reindexRepositoryForSemanticStorage(
  repository: BlueRepository,
  options: SemanticRepositoryReindexOptions = {},
): BlueRepository {
  const useDefaultCache = options.mergingProcessor === undefined;
  if (useDefaultCache) {
    const cached = DEFAULT_REINDEX_CACHE.get(repository);
    if (cached) {
      return cached;
    }
  }

  const entries = collectEntries(repository);
  if (entries.length === 0) {
    if (useDefaultCache) {
      DEFAULT_REINDEX_CACHE.set(repository, repository);
    }
    return repository;
  }

  const aliases = collectAliases(repository);
  const mergingProcessor =
    options.mergingProcessor ?? createDefaultMergingProcessor();
  let idByOldId = Object.fromEntries(
    entries.map(({ oldBlueId }) => [oldBlueId, oldBlueId]),
  );

  for (let pass = 0; pass < MAX_REINDEX_PASSES; pass++) {
    const nextIdByOldId = calculateSemanticIds(
      entries,
      aliases,
      idByOldId,
      mergingProcessor,
    );
    if (sameMappings(idByOldId, nextIdByOldId)) {
      const reindexed = buildReindexedRepository(repository, idByOldId);
      if (useDefaultCache) {
        DEFAULT_REINDEX_CACHE.set(repository, reindexed);
      }
      return reindexed;
    }
    idByOldId = nextIdByOldId;
  }

  throw new Error('Repository semantic reindexing did not converge.');
}

function collectEntries(repository: BlueRepository): RepositoryEntry[] {
  const entries: RepositoryEntry[] = [];
  for (const [packageName, pkg] of Object.entries(repository.packages)) {
    for (const [oldBlueId, content] of Object.entries(pkg.contents)) {
      entries.push({ packageName, oldBlueId, content });
    }
  }
  return entries;
}

function collectAliases(repository: BlueRepository): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const pkg of Object.values(repository.packages)) {
    for (const [alias, blueId] of Object.entries(pkg.aliases)) {
      aliases[alias] = blueId;
    }
  }
  return aliases;
}

function calculateSemanticIds(
  entries: RepositoryEntry[],
  aliases: Record<string, string>,
  idByOldId: Record<string, string>,
  mergingProcessor: MergingProcessor,
): Record<string, string> {
  const rewrittenContentByOldId = new Map(
    entries.map(({ oldBlueId, content }) => [
      oldBlueId,
      rewriteBlueIds(content, idByOldId),
    ]),
  );
  const oldIdByFetchId = new Map<string, string>();
  for (const { oldBlueId } of entries) {
    oldIdByFetchId.set(oldBlueId, oldBlueId);
    oldIdByFetchId.set(idByOldId[oldBlueId], oldBlueId);
  }

  const parserBlue = new Blue();
  const provider = {
    fetchByBlueId(blueId: string): BlueNode[] {
      const [baseBlueId, index] = blueId.split('#');
      const oldBlueId = oldIdByFetchId.get(baseBlueId);
      if (!oldBlueId) {
        return [];
      }

      const content = rewrittenContentByOldId.get(oldBlueId);
      if (content === undefined) {
        return [];
      }

      if (Array.isArray(content)) {
        if (index !== undefined) {
          const item = content[Number(index)];
          return item === undefined ? [] : [parserBlue.jsonValueToNode(item)];
        }
        return content.map((item) => parserBlue.jsonValueToNode(item));
      }

      if (index !== undefined && index !== '0') {
        return [];
      }
      return [parserBlue.jsonValueToNode(content)];
    },
    fetchFirstByBlueId(blueId: string): BlueNode | null {
      return this.fetchByBlueId(blueId)[0] ?? null;
    },
  };

  const seedBlue = new Blue({
    nodeProvider: provider,
    mergingProcessor,
  });
  seedBlue.registerBlueIds(rewriteAliasMappings(aliases, idByOldId));

  return Object.fromEntries(
    entries.map(({ packageName, oldBlueId }) => {
      const content = rewrittenContentByOldId.get(oldBlueId);
      if (content === undefined) {
        throw new Error(`Missing repository content for ${oldBlueId}.`);
      }
      try {
        const node = seedBlue.jsonValueToNode(content);
        return [oldBlueId, seedBlue.calculateBlueIdSync(node)];
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to calculate semantic BlueId for ${packageName}/${oldBlueId}: ${reason}`,
        );
      }
    }),
  );
}

function buildReindexedRepository(
  repository: BlueRepository,
  idByOldId: Record<string, string>,
): BlueRepository {
  return {
    name: repository.name,
    repositoryVersions: repository.repositoryVersions,
    packages: Object.fromEntries(
      Object.entries(repository.packages).map(([packageName, pkg]) => [
        packageName,
        reindexPackage(pkg, idByOldId),
      ]),
    ),
  };
}

function reindexPackage(
  pkg: RepositoryPackage,
  idByOldId: Record<string, string>,
): RepositoryPackage {
  return {
    name: pkg.name,
    aliases: rewriteAliasMappings(pkg.aliases, idByOldId),
    typesMeta: Object.fromEntries(
      Object.entries(pkg.typesMeta).map(([oldBlueId, meta]) => [
        idByOldId[oldBlueId] ?? oldBlueId,
        { ...meta },
      ]),
    ),
    contents: Object.fromEntries(
      Object.entries(pkg.contents).map(([oldBlueId, content]) => [
        idByOldId[oldBlueId] ?? oldBlueId,
        rewriteBlueIds(content, idByOldId),
      ]),
    ),
    schemas: Object.fromEntries(
      Object.entries(pkg.schemas).map(([oldBlueId, schema]) => {
        const currentBlueId = idByOldId[oldBlueId] ?? oldBlueId;
        return [
          currentBlueId,
          withTypeBlueId(currentBlueId)(schema as TypeBlueIdSchema),
        ];
      }),
    ),
  };
}

function sameMappings(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

export function rewriteAliasMappings(
  aliases: Record<string, string>,
  idByOldId: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(aliases).map(([alias, blueId]) => [
      alias,
      rewriteBlueIdWithOptionalIndex(blueId, idByOldId),
    ]),
  );
}

export function rewriteBlueIds(
  value: JsonValue,
  idByOldId: Record<string, string>,
): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteBlueIds(item, idByOldId));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        key === 'blueId' && typeof nested === 'string'
          ? rewriteBlueIdWithOptionalIndex(nested, idByOldId)
          : rewriteBlueIds(nested as JsonValue, idByOldId),
      ]),
    );
  }

  return value;
}

export function rewriteBlueIdWithOptionalIndex(
  blueId: string,
  idByOldId: Record<string, string>,
): string {
  const exact = idByOldId[blueId];
  if (exact !== undefined) {
    return exact;
  }

  const match = /^(.*)(#\d+)$/.exec(blueId);
  if (!match) {
    return blueId;
  }

  const [, baseBlueId, indexSuffix] = match;
  return `${idByOldId[baseBlueId] ?? baseBlueId}${indexSuffix}`;
}
