import { BlueNode } from '../model';
import { NodeProvider } from '../NodeProvider';
import { BlueIdCalculator } from './BlueIdCalculator';
import {
  TEXT_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  DICTIONARY_TYPE_BLUE_ID,
  BASIC_TYPES,
  BASIC_TYPE_BLUE_IDS,
  CORE_TYPE_BLUE_IDS,
  CORE_TYPE_BLUE_ID_TO_NAME_MAP,
} from './Properties';

/**
 * Gets the type of a node, resolving it from the node provider if necessary
 */
function getType(
  node: BlueNode,
  nodeProvider: NodeProvider
): BlueNode | undefined {
  const type = node.getType();
  if (type === undefined) {
    return undefined;
  }

  const typeBlueId = type.getBlueId();
  if (typeBlueId !== undefined) {
    // Handle core types
    if (
      CORE_TYPE_BLUE_IDS.includes(
        typeBlueId as (typeof CORE_TYPE_BLUE_IDS)[number]
      )
    ) {
      const typeName =
        CORE_TYPE_BLUE_ID_TO_NAME_MAP[
          typeBlueId as keyof typeof CORE_TYPE_BLUE_ID_TO_NAME_MAP
        ];
      return new BlueNode().setBlueId(typeBlueId).setName(typeName);
    }

    // Fetch from node provider
    const typeNodes = nodeProvider.fetchByBlueId(typeBlueId);
    if (!typeNodes || typeNodes.length === 0) {
      return undefined;
    }
    if (typeNodes.length > 1) {
      throw new Error(
        `Expected a single node for type with blueId '${typeBlueId}', but found multiple.`
      );
    }
    return typeNodes[0];
  }

  return type;
}

/**
 * Checks if sourceType is a subtype of targetType
 */
export function isSubtype(
  subtype: BlueNode,
  supertype: BlueNode,
  nodeProvider: NodeProvider
): boolean {
  const subtypeBlueId = BlueIdCalculator.calculateBlueIdSync(subtype);
  const supertypeBlueId = BlueIdCalculator.calculateBlueIdSync(supertype);

  if (subtypeBlueId === supertypeBlueId) {
    return true;
  }

  // If subtype is a core type, check if supertype extends it
  if (
    subtypeBlueId &&
    CORE_TYPE_BLUE_IDS.includes(
      subtypeBlueId as (typeof CORE_TYPE_BLUE_IDS)[number]
    )
  ) {
    let current: BlueNode | undefined = supertype;
    while (current !== undefined) {
      const currentBlueId = BlueIdCalculator.calculateBlueIdSync(current);
      if (currentBlueId === subtypeBlueId) {
        return true;
      }
      current = getType(current, nodeProvider);
    }
    return false;
  }

  // Resolve subtype by its own BlueId if it's a reference node (BlueId-only)
  // This allows handling cases like value.getType() that return a BlueId reference,
  // so we can walk the actual definition's type chain.
  let resolvedSubtype: BlueNode = subtype;
  const subtypeRefBlueId = subtype.getBlueId();
  if (subtypeRefBlueId) {
    const fetched = nodeProvider.fetchByBlueId(subtypeRefBlueId);
    if (fetched && fetched.length === 1) {
      resolvedSubtype = fetched[0];
    }
  }

  // Walk up the type hierarchy from the resolved subtype to see if it extends supertype
  let current: BlueNode | undefined = resolvedSubtype;
  while (current !== undefined) {
    const blueId = BlueIdCalculator.calculateBlueIdSync(current);
    if (blueId === supertypeBlueId) {
      return true;
    }
    current = getType(current, nodeProvider);
  }
  return false;
}

/**
 * Checks if a type is a basic type
 */
export function isBasicType(
  type: BlueNode,
  nodeProvider: NodeProvider
): boolean {
  return BASIC_TYPE_BLUE_IDS.some((blueId) => {
    const basicTypeNode = new BlueNode().setBlueId(blueId);
    return isSubtype(type, basicTypeNode, nodeProvider);
  });
}

/**
 * Checks if a type is Text type
 */
export function isTextType(
  type: BlueNode,
  nodeProvider: NodeProvider
): boolean {
  const textTypeNode = new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID);
  return isSubtype(type, textTypeNode, nodeProvider);
}

/**
 * Checks if a type is Integer type
 */
export function isIntegerType(
  type: BlueNode,
  nodeProvider: NodeProvider
): boolean {
  const integerTypeNode = new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID);
  return isSubtype(type, integerTypeNode, nodeProvider);
}

/**
 * Checks if a type is Number/Double type
 */
export function isNumberType(
  type: BlueNode,
  nodeProvider: NodeProvider
): boolean {
  const numberTypeNode = new BlueNode().setBlueId(DOUBLE_TYPE_BLUE_ID);
  return isSubtype(type, numberTypeNode, nodeProvider);
}

/**
 * Checks if a type is Boolean type
 */
export function isBooleanType(
  type: BlueNode,
  nodeProvider: NodeProvider
): boolean {
  const booleanTypeNode = new BlueNode().setBlueId(BOOLEAN_TYPE_BLUE_ID);
  return isSubtype(type, booleanTypeNode, nodeProvider);
}

/**
 * Checks if a type is List type
 */
export function isListType(type: BlueNode | undefined): boolean {
  return type?.getBlueId() === LIST_TYPE_BLUE_ID;
}

/**
 * Checks if a type is Dictionary type
 */
export function isDictionaryType(type: BlueNode | undefined): boolean {
  return type?.getBlueId() === DICTIONARY_TYPE_BLUE_ID;
}

/**
 * Checks if a node is a subtype of a basic type
 */
export function isSubtypeOfBasicType(
  type: BlueNode,
  nodeProvider: NodeProvider
): boolean {
  return BASIC_TYPES.some((basicTypeName) => {
    const basicTypeNode = new BlueNode().setName(basicTypeName);
    return isSubtype(type, basicTypeNode, nodeProvider);
  });
}

/**
 * Finds the name of the basic type that this type extends
 */
export function findBasicTypeName(
  type: BlueNode,
  nodeProvider: NodeProvider
): string {
  for (const basicTypeName of BASIC_TYPES) {
    const basicTypeNode = new BlueNode().setName(basicTypeName);
    if (isSubtype(type, basicTypeNode, nodeProvider)) {
      return basicTypeName;
    }
  }
  throw new Error(
    `Cannot determine the basic type for node of type "${
      type.getName() || 'unknown'
    }".`
  );
}
