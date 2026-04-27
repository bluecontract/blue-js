import type { JsonValue } from '@blue-labs/shared-utils';
import { repository as rawBlueRepository } from '@blue-repository/types';
import { blueIds as rawCoreBlueIds } from '@blue-repository/types/packages/core/blue-ids';
import { blueIds as rawConversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as rawMyOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';
import {
  Blue,
  BlueNode,
  type BlueRepository,
  withTypeBlueId,
} from '@blue-labs/language';
import { createDefaultMergingProcessor } from '../merge/utils/default.js';

interface RepositoryEntry {
  packageName: string;
  oldBlueId: string;
  content: JsonValue;
}

type RepositoryPackage = BlueRepository['packages'][string];
type TypeBlueIdSchema = Parameters<ReturnType<typeof withTypeBlueId>>[0];

const REINDEX_CACHE = new WeakMap<BlueRepository, BlueRepository>();
const MAX_REINDEX_PASSES = 10;

export const blueRepository =
  reindexRepositoryForSemanticStorage(rawBlueRepository);

export const blueIds = packageAliases<typeof rawCoreBlueIds>('core');
export const conversationBlueIds =
  packageAliases<typeof rawConversationBlueIds>('conversation');
export const myosBlueIds = packageAliases<typeof rawMyOsBlueIds>('myos');

export function reindexRepositoryForSemanticStorage(
  repository: BlueRepository,
): BlueRepository {
  const cached = REINDEX_CACHE.get(repository);
  if (cached) {
    return cached;
  }

  const entries = collectEntries(repository);
  if (entries.length === 0) {
    REINDEX_CACHE.set(repository, repository);
    return repository;
  }

  const aliases = collectAliases(repository);
  let idByOldId = Object.fromEntries(
    entries.map(({ oldBlueId }) => [oldBlueId, oldBlueId]),
  );

  for (let pass = 0; pass < MAX_REINDEX_PASSES; pass++) {
    const nextIdByOldId = calculateSemanticIds(entries, aliases, idByOldId);
    if (sameMappings(idByOldId, nextIdByOldId)) {
      const reindexed = buildReindexedRepository(repository, idByOldId);
      REINDEX_CACHE.set(repository, reindexed);
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
          return item === undefined ? [] : [seedBlue.jsonValueToNode(item)];
        }
        return content.map((item) => seedBlue.jsonValueToNode(item));
      }

      if (index !== undefined && index !== '0') {
        return [];
      }
      return [seedBlue.jsonValueToNode(content)];
    },
    fetchFirstByBlueId(blueId: string): BlueNode | null {
      return this.fetchByBlueId(blueId)[0] ?? null;
    },
  };

  const seedBlue = new Blue({
    nodeProvider: provider,
    mergingProcessor: createDefaultMergingProcessor(),
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
        {
          ...meta,
          status: 'stable' as const,
          versions: meta.versions,
        },
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

function rewriteAliasMappings(
  aliases: Record<string, string>,
  idByOldId: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(aliases).map(([alias, blueId]) => [
      alias,
      idByOldId[blueId] ?? blueId,
    ]),
  );
}

function rewriteBlueIds(
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
          ? (idByOldId[nested] ?? nested)
          : rewriteBlueIds(nested as JsonValue, idByOldId),
      ]),
    );
  }

  return value;
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

function packageAliases<T extends Record<string, string>>(
  packageName: string,
): T {
  const pkg = blueRepository.packages[packageName];
  if (!pkg) {
    throw new Error(
      `Missing reindexed Blue repository package ${packageName}.`,
    );
  }
  return pkg.aliases as T;
}
