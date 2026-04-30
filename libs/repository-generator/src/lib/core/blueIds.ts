import { Blue, createNodeProvider } from '@blue-labs/language';
import { OBJECT_CONTRACTS } from '@blue-labs/repository-contract';
import type { JsonValue } from '@blue-labs/shared-utils';
import { Alias, DiscoveredType, JsonMap } from './internalTypes';
import { PRIMITIVE_BLUE_IDS, PRIMITIVE_TYPES } from './constants';
import { cloneJson, isRecord } from './utils';
import { createRepositoryGeneratorMergingProcessor } from './mergingProcessor';

export function computeBlueIds(
  topoOrder: Alias[],
  discovered: Map<Alias, DiscoveredType>,
): {
  aliasToBlueId: Map<Alias, string>;
  aliasToStorageContent: Map<Alias, JsonMap>;
} {
  const aliasToBlueId = new Map<Alias, string>();
  const aliasToStorageContent = new Map<Alias, JsonMap>();
  const contentByBlueId = new Map<string, JsonValue>();
  const parserBlue = new Blue();
  const provider = createNodeProvider((blueId) =>
    lookupStorageContentByBlueId(contentByBlueId, blueId).map((content) =>
      parserBlue.jsonValueToNode(content),
    ),
  );
  const blue = new Blue({
    nodeProvider: provider,
    mergingProcessor: createRepositoryGeneratorMergingProcessor(),
  });

  for (const alias of topoOrder) {
    const type = discovered.get(alias);
    if (!type) {
      continue;
    }
    const substituted = substituteAliases(
      cloneJson(type.content),
      aliasToBlueId,
    ) as JsonMap;
    const node = blue.jsonValueToNode(substituted);

    const isPrimitive = PRIMITIVE_TYPES.has(type.typeName);
    const blueId = isPrimitive
      ? getPrimitiveBlueId(type.typeName)
      : blue.calculateBlueIdSync(node);

    const storageContent = blue.nodeToJson(node, 'official') as JsonMap;

    aliasToBlueId.set(alias, blueId);
    aliasToStorageContent.set(alias, storageContent);
    if (!isPrimitive) {
      contentByBlueId.set(blueId, storageContent);
    }
    blue.registerBlueIds({ [alias]: blueId });
  }

  return { aliasToBlueId, aliasToStorageContent };
}

export function lookupStorageContentByBlueId(
  contentByBlueId: ReadonlyMap<string, JsonValue>,
  blueId: string,
): JsonValue[] {
  const parsed = parseIndexedBlueId(blueId);
  if (parsed === undefined) {
    return [];
  }

  const content = contentByBlueId.get(parsed.baseBlueId);
  if (content === undefined) {
    return [];
  }

  if (parsed.index === undefined) {
    return Array.isArray(content) ? content : [content];
  }

  if (!Array.isArray(content)) {
    return parsed.index === 0 ? [content] : [];
  }

  const item = content[parsed.index];
  return item === undefined ? [] : [item];
}

function parseIndexedBlueId(
  blueId: string,
): { baseBlueId: string; index?: number } | undefined {
  const separatorIndex = blueId.indexOf('#');
  if (separatorIndex === -1) {
    return { baseBlueId: blueId };
  }

  const baseBlueId = blueId.slice(0, separatorIndex);
  const indexText = blueId.slice(separatorIndex + 1);
  const index = Number(indexText);
  if (!Number.isInteger(index) || index < 0) {
    return undefined;
  }

  return { baseBlueId, index };
}

export function substituteAliases(
  content: JsonValue,
  aliasToBlueId: Map<Alias, string>,
  skipContracts = false,
  underContracts = false,
): JsonValue {
  if (Array.isArray(content)) {
    return content.map((item) =>
      substituteAliases(
        item as JsonValue,
        aliasToBlueId,
        skipContracts,
        underContracts,
      ),
    );
  }

  if (!isRecord(content)) {
    return content;
  }

  const updated: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(content)) {
    const inContracts = underContracts || key === OBJECT_CONTRACTS;

    if (
      (key === 'type' ||
        key === 'itemType' ||
        key === 'keyType' ||
        key === 'valueType') &&
      typeof value === 'string' &&
      !(skipContracts && inContracts)
    ) {
      if (PRIMITIVE_TYPES.has(value)) {
        const primitiveId = PRIMITIVE_BLUE_IDS[value];
        if (!primitiveId) {
          throw new Error(`Missing primitive BlueId for ${value}.`);
        }
        updated[key] = { blueId: primitiveId };
      } else {
        const alias = value as Alias;
        const blueId = aliasToBlueId.get(alias);
        if (!blueId) {
          throw new Error(`Missing BlueId for alias ${alias}.`);
        }
        updated[key] = { blueId };
      }
      continue;
    }

    updated[key] = substituteAliases(
      value as JsonValue,
      aliasToBlueId,
      skipContracts,
      inContracts,
    );
  }

  return updated;
}
function getPrimitiveBlueId(typeName: string): string {
  const primitiveId = PRIMITIVE_BLUE_IDS[typeName];
  if (!primitiveId) {
    throw new Error(`Missing primitive BlueId for ${typeName}.`);
  }
  return primitiveId;
}
