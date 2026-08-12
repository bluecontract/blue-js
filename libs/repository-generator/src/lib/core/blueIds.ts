import {
  Blue,
  BlueIdCalculator,
  BlueNode,
  JsonCanonicalizer,
  NodeProviderWrapper,
  NodeToBlueIdInput,
  createNodeProvider,
} from '@blue-labs/language';
import { OBJECT_CONTRACTS } from '@blue-labs/repository-contract';
import type { JsonValue } from '@blue-labs/shared-utils';
import {
  Alias,
  DiscoveredType,
  JsonMap,
  PackageTypeMap,
} from './internalTypes';
import { PRIMITIVE_BLUE_IDS, PRIMITIVE_TYPES } from './constants';
import { cloneJson, isPlainObject, isRecord } from './utils';
import { createRepositoryGeneratorMergingProcessor } from './mergingProcessor';
import type { AliasComponent, DependencyGraph } from './graph';
import { BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID } from './builtinRuntimeTypes';
import {
  canonicalizeRepositoryStorageContent,
  canonicalizeRepositoryStorageMap,
} from './repositoryContent';

export const ZERO_BLUE_ID = '00000000000000000000000000000000000000000000';

interface BlueIdContext {
  blue: Blue;
  contentByBlueId: Map<string, JsonValue>;
}

interface TypeStorageResult {
  node: BlueNode;
  storageContent: JsonMap;
}

interface PreservedTypeContent {
  blueId: string;
  content: JsonMap;
}

export function computeBlueIds(
  componentOrder: AliasComponent[],
  discovered: Map<Alias, DiscoveredType>,
  dependencyGraph: DependencyGraph,
  previousTypes: PackageTypeMap,
): {
  aliasToBlueId: Map<Alias, string>;
  aliasToStorageContent: Map<Alias, JsonMap>;
  aliasToProviderContent: Map<Alias, JsonMap>;
} {
  const aliasToBlueId = new Map<Alias, string>();
  const aliasToStorageContent = new Map<Alias, JsonMap>();
  const aliasToProviderContent = new Map<Alias, JsonMap>();
  const contentByBlueId = new Map<string, JsonValue>(
    Object.entries(BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID),
  );
  const parserBlue = new Blue();
  const provider = createNodeProvider((blueId) => {
    if (isCyclicPlaceholderBlueId(blueId)) {
      return [new BlueNode().setReferenceBlueId(blueId)];
    }
    return lookupStorageContentByBlueId(contentByBlueId, blueId).map(
      (content) =>
        parserBlue.jsonValueToNode(
          canonicalizeRepositoryStorageContent(content),
        ),
    );
  });
  const blue = new Blue({
    nodeProvider: NodeProviderWrapper.unverified(provider),
    mergingProcessor: createRepositoryGeneratorMergingProcessor(),
  });
  const context: BlueIdContext = { blue, contentByBlueId };

  for (const component of componentOrder) {
    if (isCyclicComponent(component, dependencyGraph)) {
      computeCyclicComponent({
        component,
        discovered,
        previousTypes,
        aliasToBlueId,
        aliasToStorageContent,
        aliasToProviderContent,
        context,
      });
      continue;
    }

    const alias = component[0];
    if (!alias) {
      continue;
    }
    const type = discovered.get(alias);
    if (!type) {
      continue;
    }

    computeAcyclicType({
      alias,
      type,
      previousTypes,
      aliasToBlueId,
      aliasToStorageContent,
      aliasToProviderContent,
      context,
    });
  }

  return {
    aliasToBlueId,
    aliasToStorageContent,
    aliasToProviderContent,
  };
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

function isCyclicPlaceholderBlueId(blueId: string): boolean {
  return blueId === ZERO_BLUE_ID || /^this#\d+$/.test(blueId);
}

export function substituteAliases(
  content: JsonValue,
  aliasToBlueId: Map<Alias, string>,
  skipContracts = false,
  underContracts = false,
): JsonValue {
  return substituteAliasesWithLookup(
    content,
    (alias) => aliasToBlueId.get(alias),
    skipContracts,
    underContracts,
  );
}

function substituteAliasesWithLookup(
  content: JsonValue,
  lookupBlueId: (alias: Alias) => string | undefined,
  skipContracts = false,
  underContracts = false,
): JsonValue {
  if (Array.isArray(content)) {
    return content.map((item) =>
      substituteAliasesWithLookup(
        item as JsonValue,
        lookupBlueId,
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
        const blueId = lookupBlueId(alias);
        if (!blueId) {
          throw new Error(`Missing BlueId for alias ${alias}.`);
        }
        updated[key] = { blueId };
      }
      continue;
    }

    updated[key] = substituteAliasesWithLookup(
      value as JsonValue,
      lookupBlueId,
      skipContracts,
      inContracts,
    );
  }

  return updated;
}

function computeAcyclicType({
  alias,
  type,
  previousTypes,
  aliasToBlueId,
  aliasToStorageContent,
  aliasToProviderContent,
  context,
}: {
  alias: Alias;
  type: DiscoveredType;
  previousTypes: PackageTypeMap;
  aliasToBlueId: Map<Alias, string>;
  aliasToStorageContent: Map<Alias, JsonMap>;
  aliasToProviderContent: Map<Alias, JsonMap>;
  context: BlueIdContext;
}) {
  const { node, storageContent } = buildStorageNode(
    type,
    (ref) => aliasToBlueId.get(ref),
    context.blue,
  );
  const isPrimitive = PRIMITIVE_TYPES.has(type.typeName);
  const primitiveBlueId = isPrimitive
    ? getPrimitiveBlueId(type.typeName)
    : undefined;
  const calculatedBlueId =
    primitiveBlueId ?? BlueIdCalculator.calculateBlueIdSync(node);
  // Keep the pre-1.0 generator calculation as a validation pass and as the
  // narrowly-scoped migration fingerprint for an existing aggregate. New
  // identities always use the direct calculation above.
  const legacyGeneratorBlueId = isPrimitive
    ? primitiveBlueId
    : context.blue.calculateBlueIdSync(node);
  const builtinProviderContent =
    BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID[calculatedBlueId];
  const preserved = getPreviousForUnchangedContent(
    previousTypes,
    type,
    storageContent,
  );
  const preservesDirectBlueId = preserved?.blueId === calculatedBlueId;
  if (preserved && !preservesDirectBlueId) {
    if (preserved.blueId !== legacyGeneratorBlueId) {
      throw new Error(
        `Stored content for ${alias} has BlueId ${preserved.blueId}, which matches neither direct BlueId ${calculatedBlueId} nor legacy generator BlueId ${legacyGeneratorBlueId}.`,
      );
    }
  }
  const blueId = preservesDirectBlueId ? preserved.blueId : calculatedBlueId;
  const finalStorageContent = preserved?.content ?? storageContent;

  aliasToBlueId.set(alias, blueId);
  aliasToStorageContent.set(alias, finalStorageContent);
  aliasToProviderContent.set(
    alias,
    builtinProviderContent
      ? canonicalizeRepositoryStorageMap(builtinProviderContent as JsonMap)
      : providerContent(node, context.blue),
  );
  if (!isPrimitive) {
    context.contentByBlueId.set(blueId, finalStorageContent);
  }
  context.blue.registerBlueIds({ [alias]: blueId });
}

function computeCyclicComponent({
  component,
  discovered,
  previousTypes,
  aliasToBlueId,
  aliasToStorageContent,
  aliasToProviderContent,
  context,
}: {
  component: AliasComponent;
  discovered: Map<Alias, DiscoveredType>;
  previousTypes: PackageTypeMap;
  aliasToBlueId: Map<Alias, string>;
  aliasToStorageContent: Map<Alias, JsonMap>;
  aliasToProviderContent: Map<Alias, JsonMap>;
  context: BlueIdContext;
}) {
  const componentAliases = new Set(component);

  const preliminary = component.map((alias) => {
    const type = getDiscoveredType(discovered, alias);
    const { node } = buildStorageNode(
      type,
      (ref) =>
        componentAliases.has(ref) ? ZERO_BLUE_ID : aliasToBlueId.get(ref),
      context.blue,
    );
    const preparedNode = node;
    return {
      alias,
      preliminaryBlueId:
        BlueIdCalculator.calculateBlueIdAllowingCyclicPlaceholdersSync(
          preparedNode,
        ),
      preliminaryCanonicalJson: canonicalPreliminaryInput(preparedNode),
    };
  });

  validateUniquePreliminaryBlueIds(preliminary);
  preliminary.sort(comparePreliminaryDocuments);

  const sortedIndexByAlias = new Map<Alias, number>();
  preliminary.forEach(({ alias }, index) => {
    sortedIndexByAlias.set(alias, index);
  });

  const storageByAlias = new Map<Alias, TypeStorageResult>();
  for (const alias of component) {
    const type = getDiscoveredType(discovered, alias);
    const storage = buildStorageNode(
      type,
      (ref) => {
        if (!componentAliases.has(ref)) {
          return aliasToBlueId.get(ref);
        }
        const sortedIndex = sortedIndexByAlias.get(ref);
        if (sortedIndex === undefined) {
          throw new Error(`Failed to resolve cyclic reference ${ref}.`);
        }
        return `this#${sortedIndex}`;
      },
      context.blue,
    );
    storageByAlias.set(alias, storage);
  }

  const sortedNodes = preliminary.map(({ alias }) => {
    const storage = storageByAlias.get(alias);
    if (!storage) {
      throw new Error(`Failed to build cyclic content for type ${alias}.`);
    }
    return storage.node;
  });
  const sortedStorageContent = preliminary.map(({ alias }) => {
    const storage = storageByAlias.get(alias);
    if (!storage) {
      throw new Error(`Failed to build cyclic content for type ${alias}.`);
    }
    return storage.storageContent;
  });
  const masterBlueId =
    BlueIdCalculator.calculateBlueIdAllowingCyclicPlaceholdersSync(sortedNodes);

  preliminary.forEach(({ alias }, index) => {
    const providerNode = sortedNodes[index];
    if (!providerNode) {
      throw new Error(
        `Failed to build exact cyclic provider content for ${alias}.`,
      );
    }
    aliasToProviderContent.set(
      alias,
      providerContent(providerNode, context.blue),
    );
  });

  const preservedByAlias = getPreservedCyclicContent(
    component,
    discovered,
    previousTypes,
    storageByAlias,
  );
  if (preservedByAlias) {
    const matchesDirectBlueIds = cyclicBlueIdsMatch(
      preliminary,
      preservedByAlias,
      masterBlueId,
    );
    if (matchesDirectBlueIds) {
      for (const alias of component) {
        const preserved = preservedByAlias.get(alias);
        if (!preserved) {
          throw new Error(
            `Failed to preserve cyclic BlueId for type ${alias}.`,
          );
        }
        aliasToBlueId.set(alias, preserved.blueId);
        aliasToStorageContent.set(alias, preserved.content);
        context.blue.registerBlueIds({ [alias]: preserved.blueId });
      }
      storeCyclicContentByBlueId(context.contentByBlueId, preservedByAlias);
      return;
    }

    const legacyMasterBlueId = context.blue.calculateBlueIdSync(sortedNodes);
    if (
      !cyclicBlueIdsMatch(preliminary, preservedByAlias, legacyMasterBlueId)
    ) {
      throw new Error(
        `Stored cyclic content matches neither direct master BlueId ${masterBlueId} nor legacy generator master BlueId ${legacyMasterBlueId}.`,
      );
    }
  }
  context.contentByBlueId.set(masterBlueId, sortedStorageContent);

  preliminary.forEach(({ alias }, index) => {
    const storage = storageByAlias.get(alias);
    if (!storage) {
      throw new Error(`Failed to build cyclic content for type ${alias}.`);
    }
    const blueId = `${masterBlueId}#${index}`;
    aliasToBlueId.set(alias, blueId);
    aliasToStorageContent.set(alias, storage.storageContent);
    context.blue.registerBlueIds({ [alias]: blueId });
  });
}

function cyclicBlueIdsMatch(
  preliminary: ReadonlyArray<{ alias: Alias }>,
  preservedByAlias: ReadonlyMap<Alias, PreservedTypeContent>,
  masterBlueId: string,
): boolean {
  return preliminary.every(
    ({ alias }, index) =>
      preservedByAlias.get(alias)?.blueId === `${masterBlueId}#${index}`,
  );
}

function providerContent(node: BlueNode, blue: Blue): JsonMap {
  return canonicalizeRepositoryStorageMap(
    blue.nodeToJson(node, 'official') as JsonMap,
  );
}

function isCyclicComponent(
  component: AliasComponent,
  dependencyGraph: DependencyGraph,
): boolean {
  if (component.length > 1) {
    return true;
  }

  const alias = component[0];
  return alias ? (dependencyGraph.get(alias)?.has(alias) ?? false) : false;
}

function buildStorageNode(
  type: DiscoveredType,
  lookupBlueId: (alias: Alias) => string | undefined,
  blue: Blue,
): TypeStorageResult {
  const substituted = substituteAliasesWithLookup(
    cloneJson(type.content),
    lookupBlueId,
  ) as JsonMap;
  try {
    const node = blue.jsonValueToNode(substituted);
    const storageContent = canonicalizeRepositoryStorageMap(
      blue.nodeToJson(node, 'official') as JsonMap,
    );
    return {
      node,
      storageContent,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error encountered.';
    throw new Error(`Failed to build ${type.filePath}: ${message}`);
  }
}

function getDiscoveredType(
  discovered: Map<Alias, DiscoveredType>,
  alias: Alias,
): DiscoveredType {
  const type = discovered.get(alias);
  if (!type) {
    throw new Error(`Unknown type alias ${alias}.`);
  }
  return type;
}

function getPreservedCyclicContent(
  component: AliasComponent,
  discovered: Map<Alias, DiscoveredType>,
  previousTypes: PackageTypeMap,
  storageByAlias: Map<Alias, TypeStorageResult>,
): Map<Alias, PreservedTypeContent> | null {
  const preservedByAlias = new Map<Alias, PreservedTypeContent>();
  for (const alias of component) {
    const type = getDiscoveredType(discovered, alias);
    const storage = storageByAlias.get(alias);
    if (!storage) {
      throw new Error(`Failed to build cyclic content for type ${alias}.`);
    }
    const preserved = getPreviousForUnchangedContent(
      previousTypes,
      type,
      storage.storageContent,
    );
    if (!preserved) {
      return null;
    }
    preservedByAlias.set(alias, preserved);
  }
  return preservedByAlias;
}

function getPreviousForUnchangedContent(
  previousTypes: PackageTypeMap,
  type: DiscoveredType,
  currentContent: JsonMap,
): PreservedTypeContent | null {
  const previousType = previousTypes.get(type.packageName)?.get(type.typeName);
  const previousBlueId = previousType?.versions?.at(-1)?.typeBlueId;
  if (
    !previousBlueId ||
    !previousType ||
    !isPlainObject(previousType.content)
  ) {
    return null;
  }

  const previousContent = previousType.content as JsonMap;
  if (!jsonEquals(previousContent, currentContent)) {
    return null;
  }

  return {
    blueId: previousBlueId,
    content: cloneJson(previousContent),
  };
}

function storeCyclicContentByBlueId(
  contentByBlueId: Map<string, JsonValue>,
  preservedByAlias: Map<Alias, PreservedTypeContent>,
) {
  const grouped = new Map<string, Array<{ index: number; content: JsonMap }>>();

  for (const { blueId, content } of preservedByAlias.values()) {
    const parsed = parseIndexedBlueId(blueId);
    if (!parsed || parsed.index === undefined) {
      contentByBlueId.set(blueId, content);
      continue;
    }
    const entries = grouped.get(parsed.baseBlueId) ?? [];
    entries.push({ index: parsed.index, content });
    grouped.set(parsed.baseBlueId, entries);
  }

  for (const [baseBlueId, entries] of grouped) {
    const sorted = [...entries].sort((a, b) => a.index - b.index);
    const content = sorted.map((entry, expectedIndex) => {
      if (entry.index !== expectedIndex) {
        throw new Error(
          `Cyclic repository content for ${baseBlueId} is missing index ${expectedIndex}.`,
        );
      }
      return entry.content;
    });
    contentByBlueId.set(baseBlueId, content);
  }
}

function validateUniquePreliminaryBlueIds(
  preliminary: Array<{
    alias: Alias;
    preliminaryBlueId: string;
    preliminaryCanonicalJson: string;
  }>,
) {
  const aliasByInput = new Map<string, Alias>();
  for (const document of preliminary) {
    const key = `${document.preliminaryBlueId}\u0000${document.preliminaryCanonicalJson}`;
    const existingAlias = aliasByInput.get(key);
    if (existingAlias) {
      throw new Error(
        `Direct cyclic type set has duplicate preliminary input: ${existingAlias} and ${document.alias} share preliminary BlueId '${document.preliminaryBlueId}'.`,
      );
    }
    aliasByInput.set(key, document.alias);
  }
}

function comparePreliminaryDocuments(
  left: { preliminaryBlueId: string; preliminaryCanonicalJson: string },
  right: { preliminaryBlueId: string; preliminaryCanonicalJson: string },
): number {
  if (left.preliminaryBlueId < right.preliminaryBlueId) {
    return -1;
  }
  if (left.preliminaryBlueId > right.preliminaryBlueId) {
    return 1;
  }
  return compareUtf8(
    left.preliminaryCanonicalJson,
    right.preliminaryCanonicalJson,
  );
}

function canonicalPreliminaryInput(node: BlueNode): string {
  const canonical = JsonCanonicalizer.canonicalize(
    NodeToBlueIdInput.getAllowingCyclicPlaceholders(node),
  );
  if (canonical === undefined) {
    throw new Error('Unable to canonicalize preliminary cyclic BlueId input.');
  }
  return canonical;
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index] - rightBytes[index];
    if (difference !== 0) {
      return difference;
    }
  }
  return leftBytes.length - rightBytes.length;
}

function jsonEquals(a: JsonValue, b: JsonValue): boolean {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => jsonEquals(item as JsonValue, b[index]));
  }

  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) {
      return false;
    }
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every(
      (key, index) =>
        key === bKeys[index] &&
        jsonEquals(a[key] as JsonValue, b[key] as JsonValue),
    );
  }

  return false;
}

function getPrimitiveBlueId(typeName: string): string {
  const primitiveId = PRIMITIVE_BLUE_IDS[typeName];
  if (!primitiveId) {
    throw new Error(`Missing primitive BlueId for ${typeName}.`);
  }
  return primitiveId;
}
