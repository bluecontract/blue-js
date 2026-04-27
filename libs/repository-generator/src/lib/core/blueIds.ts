import { Blue, createNodeProvider } from '@blue-labs/language';
import { OBJECT_CONTRACTS } from '@blue-labs/repository-contract';
import type { JsonValue } from '@blue-labs/shared-utils';
import { Alias, DiscoveredType, JsonMap } from './internalTypes';
import { PRIMITIVE_BLUE_IDS, PRIMITIVE_TYPES } from './constants';
import { cloneJson, isRecord } from './utils';

export function computeBlueIds(
  topoOrder: Alias[],
  discovered: Map<Alias, DiscoveredType>,
): {
  aliasToBlueId: Map<Alias, string>;
  aliasToStorageContent: Map<Alias, JsonMap>;
} {
  const aliasToBlueId = new Map<Alias, string>();
  const aliasToStorageContent = new Map<Alias, JsonMap>();
  const contentByBlueId = new Map<string, JsonMap>();
  const parserBlue = new Blue();
  const provider = createNodeProvider((blueId) => {
    const content = contentByBlueId.get(blueId.split('#')[0]);
    return content ? [parserBlue.jsonValueToNode(content)] : [];
  });
  const blue = new Blue({ nodeProvider: provider });

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
