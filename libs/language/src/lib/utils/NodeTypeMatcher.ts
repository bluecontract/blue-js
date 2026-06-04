import { Blue } from '../Blue';
import { BlueNode } from '../model';
import { ResolvedBlueNode } from '../model/ResolvedNode';
import type { Schema } from '../model/Schema';
import { CompositeLimits, Limits, NO_LIMITS, PathLimits } from './limits';
import {
  isBigIntegerNumber,
  isBigNumber,
} from '../../utils/typeGuards/isBigNumber';
import { NodeTypes } from './index';
import * as Properties from './Properties';

// Bare blueId matchers normally compare node identity. Inside collection
// itemType/valueType declarations, the same bare blueId represents a type
// reference, so values typed as that blueId should match.
type BareBlueIdMatcherMode = 'identity' | 'type-reference';

interface ValueComparisonOptions {
  readonly bareBlueIdMatcherMode?: BareBlueIdMatcherMode;
}

export interface NodeTypeMatcherMemo {
  get(pointer: string, expectedTypeBlueId: string): boolean | undefined;
  set(pointer: string, expectedTypeBlueId: string, value: boolean): void;
}

export interface NodeTypeMatcherOptions {
  readonly memo?: NodeTypeMatcherMemo;
  readonly pointer?: string;
  readonly limits?: Limits;
}

export class NodeTypeMatcher {
  private blue: Blue;

  constructor(blue: Blue) {
    this.blue = blue;
  }

  public matchesType(
    node: BlueNode,
    targetType: BlueNode,
    globalLimits: Limits = NO_LIMITS,
    options: NodeTypeMatcherOptions = {},
  ): boolean {
    if (
      this.isTypeOnlyMatcher(targetType) &&
      this.targetTypeReferenceHasNoDefinition(targetType) &&
      this.matchesUnresolvedExactTypeOnly(node, targetType)
    ) {
      return true;
    }

    try {
      // Derive path limits from the target type structure
      const pathLimits = PathLimits.fromNode(targetType);
      const effectiveGlobalLimits =
        options.limits === undefined
          ? globalLimits
          : CompositeLimits.of(globalLimits, options.limits);
      const compositeLimits = CompositeLimits.of(
        effectiveGlobalLimits,
        pathLimits,
      );
      const resolvedNode = this.extendAndResolve(node, compositeLimits);
      const resolvedType = this.blue.resolve(targetType, compositeLimits);
      const comparisonTargetType =
        this.expandSchemaOwnedTypeReferences(targetType);

      const valuesMatch = this.recursiveValueComparison(
        resolvedNode,
        resolvedType,
        comparisonTargetType,
        compositeLimits,
        {},
        this.normalizeMatcherPointer(options.pointer),
        options.memo,
      );
      if (!valuesMatch) {
        return false;
      }

      if (this.isTypeOnlyMatcher(targetType)) {
        return true;
      }

      return (
        this.verifyMatch(resolvedNode, targetType, compositeLimits) ||
        targetType.getType() === undefined
      );
    } catch {
      return this.matchesUnresolvedExactTypeOnly(node, targetType);
    }
  }

  /**
   * Resolves a node with the runtime while preserving any structure that could
   * be dropped during resolution (items, properties, identifiers, values).
   */
  private extendAndResolve(node: BlueNode, limits: Limits): BlueNode {
    const originalClone = node.clone();
    const extendedClone = originalClone.clone();

    this.blue.extend(extendedClone, limits);
    const resolved = this.blue.resolve(extendedClone, limits);

    this.restoreMissingStructure(resolved, originalClone);

    return resolved;
  }

  /**
   * Recursively copies structural information from the original node to the
   * resolved node so comparisons can still see user-provided shape data.
   */
  private restoreMissingStructure(target: BlueNode, source: BlueNode): void {
    const sourceItems = source.getItems();
    const targetItems = target.getItems();

    if (sourceItems && sourceItems.length > 0) {
      if (!targetItems || targetItems.length === 0) {
        target.setItems(sourceItems.map((item) => item.clone()));
      } else {
        for (
          let i = 0;
          i < Math.min(targetItems.length, sourceItems.length);
          i++
        ) {
          this.restoreMissingStructure(targetItems[i], sourceItems[i]);
        }
      }
    }

    const sourceProps = source.getProperties();
    if (sourceProps) {
      let targetProps = target.getProperties();
      if (!targetProps) {
        targetProps = {};
        target.setProperties(targetProps);
      }

      for (const [key, value] of Object.entries(sourceProps)) {
        const targetValue = targetProps[key];
        if (targetValue === undefined) {
          targetProps[key] = value.clone();
        } else {
          this.restoreMissingStructure(targetValue, value);
        }
      }
    }

    const sourceBlueId = source.getBlueId();
    if (target.getBlueId() === undefined && sourceBlueId !== undefined) {
      target.setBlueId(sourceBlueId);
    }

    const sourceValue = source.getValue();
    if (target.getValue() === undefined && sourceValue !== undefined) {
      target.setValue(sourceValue);
    }
  }

  private verifyMatch(
    resolvedNode: BlueNode,
    targetType: BlueNode,
    limits: Limits,
  ): boolean {
    // Fast-path: allow implicit structural match for core List/Dictionary when node lacks explicit type
    const targetTypeType = targetType.getType();
    if (this.matchesImplicitStructure(resolvedNode, targetTypeType)) {
      return true;
    }

    const testNode = resolvedNode.clone().setType(targetType.clone());
    try {
      this.blue.resolve(testNode, limits);
    } catch {
      return false;
    }
    return true;
  }

  private recursiveValueComparison(
    node: BlueNode,
    targetType: BlueNode,
    comparisonTargetType: BlueNode = targetType,
    limits: Limits = NO_LIMITS,
    options: ValueComparisonOptions = {},
    pointer?: string,
    memo?: NodeTypeMatcherMemo,
  ): boolean {
    const expectedTypeBlueId = this.expectedTypeBlueIdForMemo(
      targetType,
      comparisonTargetType,
    );
    if (memo && pointer && expectedTypeBlueId) {
      const cached = memo.get(pointer, expectedTypeBlueId);
      if (cached !== undefined) {
        return cached;
      }
      const result = this.recursiveValueComparisonUncached(
        node,
        targetType,
        comparisonTargetType,
        limits,
        options,
        pointer,
        memo,
      );
      memo.set(pointer, expectedTypeBlueId, result);
      return result;
    }

    return this.recursiveValueComparisonUncached(
      node,
      targetType,
      comparisonTargetType,
      limits,
      options,
      pointer,
      memo,
    );
  }

  private recursiveValueComparisonUncached(
    node: BlueNode,
    targetType: BlueNode,
    comparisonTargetType: BlueNode = targetType,
    limits: Limits = NO_LIMITS,
    options: ValueComparisonOptions = {},
    pointer?: string,
    memo?: NodeTypeMatcherMemo,
  ): boolean {
    const targetTypeType = targetType.getType();
    const isImplicitStructureMatch =
      this.matchesImplicitStructure(node, targetTypeType) ||
      this.matchesImplicitCoreCollectionType(node, targetType);

    if (
      this.requiresSemanticPresence(targetType) &&
      !this.isRootMatcherPointer(pointer) &&
      this.isMetadataOnlyNode(node)
    ) {
      return false;
    }

    if (!this.matchesSchemaCardinality(node, targetType)) {
      return false;
    }

    if (
      node.getType() === undefined &&
      this.isCoreCollectionType(targetType) &&
      !isImplicitStructureMatch
    ) {
      return false;
    }
    if (targetTypeType && !isImplicitStructureMatch) {
      const nodeType = node.getType();
      if (!nodeType) {
        if (!this.matchesImplicitPrimitiveType(node, targetTypeType)) {
          return false;
        }
      } else if (
        !NodeTypes.isSubtype(
          nodeType,
          targetTypeType,
          this.blue.getNodeProvider(),
        ) &&
        !this.matchesExactTypeReference(nodeType, targetTypeType)
      ) {
        return false;
      }
    }

    const targetBlueId = targetType.getBlueId();
    if (!isImplicitStructureMatch && targetBlueId !== undefined) {
      if (this.isExplicitBlueIdMatcher(comparisonTargetType)) {
        if (options.bareBlueIdMatcherMode === 'type-reference') {
          if (
            !this.matchesBareBlueIdTypeReference(node, targetType, targetBlueId)
          ) {
            return false;
          }
        } else if (!this.matchesBareBlueIdIdentity(node, targetBlueId)) {
          return false;
        }
      } else {
        const nodeBlueId = node.getBlueId();
        const nodeType = node.getType();
        if (
          nodeType === undefined &&
          nodeBlueId !== undefined &&
          nodeBlueId !== targetBlueId
        ) {
          return false;
        }
        if (
          nodeType &&
          !NodeTypes.isSubtype(
            nodeType,
            targetType,
            this.blue.getNodeProvider(),
          ) &&
          !this.matchesExactTypeReference(nodeType, targetType)
        ) {
          return false;
        }
      }
    }

    const nodeBlueId = node.getBlueId();
    if (
      !isImplicitStructureMatch &&
      targetBlueId === undefined &&
      nodeBlueId !== undefined &&
      node.getType() === undefined &&
      targetType.getItems() === undefined &&
      this.hasMatcherShape(targetType) &&
      !this.matchesCalculatedBlueId(targetType, nodeBlueId)
    ) {
      return false;
    }

    const targetValue = targetType.getValue();
    if (targetValue !== undefined) {
      const nodeValue = node.getValue();
      if (nodeValue === undefined) {
        return false;
      }
      // Prefer Big.js-aware equality when applicable, else strict equality
      if (isBigNumber(nodeValue) && isBigNumber(targetValue)) {
        if (!nodeValue.eq(targetValue)) {
          return false;
        }
      } else if (nodeValue !== targetValue) {
        return false;
      }
    }

    const targetItems = targetType.getItems();
    const comparisonTargetItems = comparisonTargetType.getItems();
    if (targetItems !== undefined) {
      const nodeItems = node.getItems() ?? [];
      for (let i = 0; i < targetItems.length; i++) {
        if (i < nodeItems.length) {
          if (
            !this.recursiveValueComparison(
              nodeItems[i],
              targetItems[i],
              comparisonTargetItems?.[i] ?? targetItems[i],
              limits,
              {},
              this.childMatcherPointer(pointer, String(i)),
              memo,
            )
          ) {
            return false;
          }
        } else {
          if (
            this.requiresSemanticPresence(targetItems[i]) ||
            this.hasValueInNestedStructure(targetItems[i])
          ) {
            return false;
          }
        }
      }
      // no need to check extra items on node
    }

    const targetItemType = targetType.getItemType();
    const comparisonTargetItemType = comparisonTargetType.getItemType();
    if (targetItemType !== undefined) {
      const nodeItems = node.getItems() ?? [];
      for (let i = 0; i < nodeItems.length; i++) {
        const item = nodeItems[i];
        if (
          !this.recursiveValueComparison(
            this.resolveUntypedNodeAgainstMatcherType(
              item,
              targetItemType,
              comparisonTargetItemType ?? targetItemType,
              limits,
              'type-reference',
            ),
            targetItemType,
            comparisonTargetItemType ?? targetItemType,
            limits,
            { bareBlueIdMatcherMode: 'type-reference' },
            this.childMatcherPointer(pointer, String(i)),
            memo,
          )
        ) {
          return false;
        }
      }
    }

    const targetProps = targetType.getProperties();
    const comparisonTargetProps = comparisonTargetType.getProperties();
    if (targetProps !== undefined) {
      const nodeProps = node.getProperties() ?? {};
      for (const [key, value] of Object.entries(targetProps)) {
        if (key in nodeProps) {
          if (
            !this.recursiveValueComparison(
              nodeProps[key],
              value,
              comparisonTargetProps?.[key] ?? value,
              limits,
              {},
              this.childMatcherPointer(pointer, key),
              memo,
            )
          ) {
            return false;
          }
        } else {
          if (
            this.requiresSemanticPresence(value) ||
            this.hasValueInNestedStructure(value)
          ) {
            return false;
          }
        }
      }
    }

    const targetValueType = targetType.getValueType();
    const comparisonTargetValueType = comparisonTargetType.getValueType();
    if (targetValueType !== undefined) {
      const nodeProps = Object.entries(node.getProperties() ?? {});
      for (const [key, value] of nodeProps) {
        if (
          !this.recursiveValueComparison(
            this.resolveUntypedNodeAgainstMatcherType(
              value,
              targetValueType,
              comparisonTargetValueType ?? targetValueType,
              limits,
              'type-reference',
            ),
            targetValueType,
            comparisonTargetValueType ?? targetValueType,
            limits,
            { bareBlueIdMatcherMode: 'type-reference' },
            this.childMatcherPointer(pointer, key),
            memo,
          )
        ) {
          return false;
        }
      }
    }

    return true;
  }

  private expectedTypeBlueIdForMemo(
    targetType: BlueNode,
    comparisonTargetType: BlueNode,
  ): string | undefined {
    return (
      this.blueIdOrReference(comparisonTargetType) ??
      this.blueIdOrReference(targetType) ??
      this.blueIdOrReference(comparisonTargetType.getType()) ??
      this.blueIdOrReference(targetType.getType())
    );
  }

  private blueIdOrReference(node: BlueNode | undefined): string | undefined {
    return node?.getBlueId() ?? node?.getReferenceBlueId();
  }

  private normalizeMatcherPointer(
    pointer: string | undefined,
  ): string | undefined {
    if (pointer === undefined) {
      return undefined;
    }
    const trimmed = pointer.trim();
    if (trimmed.length === 0 || trimmed === '/') {
      return '/';
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  private childMatcherPointer(
    pointer: string | undefined,
    segment: string,
  ): string | undefined {
    if (pointer === undefined) {
      return undefined;
    }
    const escaped = segment.replace(/~/g, '~0').replace(/\//g, '~1');
    return pointer === '/' ? `/${escaped}` : `${pointer}/${escaped}`;
  }

  private resolveUntypedNodeAgainstMatcherType(
    node: BlueNode,
    targetType: BlueNode,
    comparisonTargetType: BlueNode,
    limits: Limits,
    bareBlueIdMatcherMode: BareBlueIdMatcherMode = 'identity',
  ): BlueNode {
    if (
      node.getType() !== undefined ||
      node.getBlueId() !== undefined ||
      (bareBlueIdMatcherMode === 'identity' &&
        this.isExplicitBlueIdMatcher(comparisonTargetType))
    ) {
      return node;
    }

    return this.resolveAgainstTargetType(node, targetType, limits) ?? node;
  }

  private hasValueInNestedStructure(node: BlueNode): boolean {
    if (node.getValue() !== undefined) {
      return true;
    }

    const items = node.getItems();
    if (items !== undefined) {
      for (const item of items) {
        if (this.hasValueInNestedStructure(item)) {
          return true;
        }
      }
    }

    const props = node.getProperties();
    if (props !== undefined) {
      for (const prop of Object.values(props)) {
        if (this.hasValueInNestedStructure(prop)) {
          return true;
        }
      }
    }

    return false;
  }

  private requiresSemanticPresence(node: BlueNode): boolean {
    return node.getSchema()?.get('required')?.getValue() === true;
  }

  private matchesSchemaCardinality(
    node: BlueNode,
    targetType: BlueNode,
  ): boolean {
    const schema = targetType.getSchema();
    if (!schema) {
      return true;
    }

    const minItems = this.schemaInteger(schema, 'minItems');
    if (minItems !== undefined && (node.getItems()?.length ?? 0) < minItems) {
      return false;
    }

    const maxItems = this.schemaInteger(schema, 'maxItems');
    if (maxItems !== undefined && (node.getItems()?.length ?? 0) > maxItems) {
      return false;
    }

    const fieldCount = Object.keys(node.getProperties() ?? {}).length;
    const minFields = this.schemaInteger(schema, 'minFields');
    if (minFields !== undefined && fieldCount < minFields) {
      return false;
    }

    const maxFields = this.schemaInteger(schema, 'maxFields');
    if (maxFields !== undefined && fieldCount > maxFields) {
      return false;
    }

    return true;
  }

  private schemaInteger(
    schema: Schema,
    key: 'minItems' | 'maxItems' | 'minFields' | 'maxFields',
  ): number | undefined {
    const value = schema.get(key)?.getValue();
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    if (isBigIntegerNumber(value)) {
      return Number(value.toString());
    }
    return undefined;
  }

  private isRootMatcherPointer(pointer: string | undefined): boolean {
    return pointer === undefined || pointer === '/';
  }

  private isMetadataOnlyNode(node: BlueNode): boolean {
    return (
      node.getValue() === undefined &&
      node.getItems() === undefined &&
      node.getProperties() === undefined &&
      node.getBlueId() === undefined &&
      node.getReferenceBlueId() === undefined &&
      this.hasMetadata(node)
    );
  }

  private hasMetadata(node: BlueNode): boolean {
    return (
      node.getName() !== undefined ||
      node.getDescription() !== undefined ||
      node.getType() !== undefined ||
      node.getItemType() !== undefined ||
      node.getKeyType() !== undefined ||
      node.getValueType() !== undefined ||
      node.getSchema() !== undefined ||
      node.getMergePolicy() !== undefined ||
      node.getBlue() !== undefined
    );
  }

  private hasMatcherShape(node: BlueNode): boolean {
    return (
      node.getValue() !== undefined ||
      node.getType() !== undefined ||
      node.getItemType() !== undefined ||
      node.getKeyType() !== undefined ||
      node.getValueType() !== undefined ||
      node.getItems() !== undefined ||
      node.getProperties() !== undefined
    );
  }

  private isTypeOnlyMatcher(node: BlueNode): boolean {
    return (
      node.getType() !== undefined &&
      node.getBlueId() === undefined &&
      node.getReferenceBlueId() === undefined &&
      node.getValue() === undefined &&
      node.getItems() === undefined &&
      node.getItemType() === undefined &&
      node.getKeyType() === undefined &&
      node.getValueType() === undefined &&
      node.getProperties() === undefined &&
      node.getName() === undefined &&
      node.getDescription() === undefined
    );
  }

  private matchesUnresolvedExactTypeOnly(
    node: BlueNode,
    targetType: BlueNode,
  ): boolean {
    if (!this.isTypeOnlyMatcher(targetType)) {
      return false;
    }
    const nodeType = node.getType();
    const expectedType = targetType.getType();
    return (
      nodeType !== undefined &&
      expectedType !== undefined &&
      this.matchesExactTypeReference(nodeType, expectedType)
    );
  }

  private targetTypeReferenceHasNoDefinition(targetType: BlueNode): boolean {
    const typeBlueId = this.blueIdOrReference(targetType.getType());
    if (typeBlueId === undefined) {
      return false;
    }
    const nodes = this.blue.getNodeProvider().fetchByBlueId(typeBlueId);
    return nodes == null || nodes.length === 0;
  }

  private matchesImplicitPrimitiveType(
    node: BlueNode,
    targetTypeType: BlueNode,
  ): boolean {
    const value = node.getValue();
    const targetTypeBlueId =
      this.blueIdOrReference(targetTypeType) ??
      this.primitiveAliasBlueId(targetTypeType.getValue());
    switch (targetTypeBlueId) {
      case Properties.TEXT_TYPE_BLUE_ID:
        return typeof value === 'string';
      case Properties.INTEGER_TYPE_BLUE_ID:
        return (
          (typeof value === 'number' &&
            Number.isInteger(value) &&
            Number.isSafeInteger(value)) ||
          isBigIntegerNumber(value)
        );
      case Properties.DOUBLE_TYPE_BLUE_ID:
        return typeof value === 'number' || isBigNumber(value);
      case Properties.BOOLEAN_TYPE_BLUE_ID:
        return typeof value === 'boolean';
      default:
        return false;
    }
  }

  private primitiveAliasBlueId(value: unknown): string | undefined {
    switch (value) {
      case 'Text':
        return Properties.TEXT_TYPE_BLUE_ID;
      case 'Integer':
        return Properties.INTEGER_TYPE_BLUE_ID;
      case 'Double':
        return Properties.DOUBLE_TYPE_BLUE_ID;
      case 'Boolean':
        return Properties.BOOLEAN_TYPE_BLUE_ID;
      default:
        return undefined;
    }
  }

  private matchesCalculatedBlueId(node: BlueNode, blueId: string): boolean {
    if (
      node instanceof ResolvedBlueNode &&
      node.getCompleteness() === 'path-limited' &&
      node.getSourceSemanticBlueId() !== undefined
    ) {
      return node.getSourceSemanticBlueId() === blueId;
    }

    try {
      return this.blue.calculateBlueIdSync(node) === blueId;
    } catch {
      try {
        return (
          this.blue.calculateBlueIdSync(this.toPlainBlueNode(node)) === blueId
        );
      } catch {
        return false;
      }
    }
  }

  private matchesBareBlueIdIdentity(node: BlueNode, blueId: string): boolean {
    const nodeBlueId = node.getBlueId();
    return nodeBlueId === blueId || this.matchesCalculatedBlueId(node, blueId);
  }

  private matchesBareBlueIdTypeReference(
    node: BlueNode,
    targetType: BlueNode,
    targetBlueId: string,
  ): boolean {
    const nodeType = node.getType();
    if (nodeType) {
      return NodeTypes.isSubtype(
        nodeType,
        targetType,
        this.blue.getNodeProvider(),
      );
    }

    const nodeBlueId = node.getBlueId();
    if (nodeBlueId !== undefined) {
      return this.matchesBareBlueIdIdentity(node, targetBlueId);
    }

    return false;
  }

  private matchesExactTypeReference(
    nodeType: BlueNode,
    targetType: BlueNode,
  ): boolean {
    const nodeTypeBlueId = this.blueIdOrReference(nodeType);
    const targetTypeBlueId = this.blueIdOrReference(targetType);
    return (
      nodeTypeBlueId !== undefined &&
      targetTypeBlueId !== undefined &&
      nodeTypeBlueId === targetTypeBlueId
    );
  }

  private toPlainBlueNode(node: BlueNode): BlueNode {
    const plain = new BlueNode(node.getName());
    plain
      .setDescription(node.getDescription())
      .setReferenceBlueId(node.getReferenceBlueId())
      .setInlineValue(node.isInlineValue());

    const value = node.getValue();
    if (value !== undefined) {
      plain.setValue(value);
    }

    const type = node.getType();
    if (type !== undefined) {
      plain.setType(this.toPlainBlueNode(type));
    }

    const itemType = node.getItemType();
    if (itemType !== undefined) {
      plain.setItemType(this.toPlainBlueNode(itemType));
    }

    const keyType = node.getKeyType();
    if (keyType !== undefined) {
      plain.setKeyType(this.toPlainBlueNode(keyType));
    }

    const valueType = node.getValueType();
    if (valueType !== undefined) {
      plain.setValueType(this.toPlainBlueNode(valueType));
    }

    const items = node.getItems();
    if (items !== undefined) {
      plain.setItems(items.map((item) => this.toPlainBlueNode(item)));
    }

    const properties = node.getProperties();
    if (properties !== undefined) {
      plain.setProperties(
        Object.fromEntries(
          Object.entries(properties).map(([key, valueNode]) => [
            key,
            this.toPlainBlueNode(valueNode),
          ]),
        ),
      );
    }

    const blue = node.getBlue();
    if (blue !== undefined) {
      plain.setBlue(this.toPlainBlueNode(blue));
    }

    return plain;
  }

  /**
   * Determines whether a node without an explicit type already satisfies the
   * shape of the requested core list or dictionary type.
   */
  private matchesImplicitStructure(
    node: BlueNode,
    targetTypeType: BlueNode | undefined,
  ): boolean {
    if (targetTypeType === undefined || node.getType() !== undefined) {
      return false;
    }

    if (NodeTypes.isListType(targetTypeType, this.blue.getNodeProvider())) {
      return this.isImplicitListStructure(node);
    }

    if (
      NodeTypes.isDictionaryType(targetTypeType, this.blue.getNodeProvider())
    ) {
      return this.isImplicitDictionaryStructure(node);
    }

    return false;
  }

  private matchesImplicitCoreCollectionType(
    node: BlueNode,
    targetType: BlueNode,
  ): boolean {
    if (node.getType() !== undefined) {
      return false;
    }

    if (NodeTypes.isListType(targetType, this.blue.getNodeProvider())) {
      return this.isImplicitListStructure(node);
    }

    if (NodeTypes.isDictionaryType(targetType, this.blue.getNodeProvider())) {
      return this.isImplicitDictionaryStructure(node);
    }

    return false;
  }

  private isCoreCollectionType(targetType: BlueNode): boolean {
    return (
      NodeTypes.isListType(targetType, this.blue.getNodeProvider()) ||
      NodeTypes.isDictionaryType(targetType, this.blue.getNodeProvider())
    );
  }

  private isImplicitListStructure(node: BlueNode): boolean {
    return node.getItems() !== undefined && node.getValue() === undefined;
  }

  private isImplicitDictionaryStructure(node: BlueNode): boolean {
    return node.getProperties() !== undefined && node.getValue() === undefined;
  }

  private isBareBlueIdReference(node: BlueNode): boolean {
    return (
      node.getBlueId() !== undefined &&
      node.getName() === undefined &&
      node.getDescription() === undefined &&
      node.getType() === undefined &&
      node.getValue() === undefined &&
      node.getItems() === undefined &&
      node.getItemType() === undefined &&
      node.getKeyType() === undefined &&
      node.getProperties() === undefined &&
      node.getValueType() === undefined &&
      node.getSchema() === undefined &&
      node.getMergePolicy() === undefined &&
      node.getPreviousBlueId() === undefined &&
      node.getPosition() === undefined &&
      node.getBlue() === undefined
    );
  }

  private isExplicitBlueIdMatcher(node: BlueNode): boolean {
    return this.isBareBlueIdReference(node);
  }

  private resolveAgainstTargetType(
    node: BlueNode,
    targetType: BlueNode,
    limits: Limits,
  ): BlueNode | null {
    try {
      const originalClone = node.clone();
      const typedClone = originalClone.clone().setType(targetType.clone());
      const resolved = this.blue.resolve(typedClone, limits);
      this.restoreMissingStructure(resolved, originalClone);
      return resolved;
    } catch {
      return null;
    }
  }

  private expandSchemaOwnedTypeReferences(targetType: BlueNode): BlueNode {
    if (!this.isSchemaDefinitionNode(targetType)) {
      return targetType;
    }

    return this.expandSchemaTypeReferences(targetType.clone());
  }

  private isSchemaDefinitionNode(node: BlueNode): boolean {
    return (
      node.getBlueId() !== undefined &&
      (node.getName() !== undefined ||
        node.getDescription() !== undefined ||
        node.getType() !== undefined ||
        node.getItemType() !== undefined ||
        node.getKeyType() !== undefined ||
        node.getValueType() !== undefined ||
        node.getItems() !== undefined ||
        node.getProperties() !== undefined)
    );
  }

  private expandSchemaTypeReferences(
    node: BlueNode,
    visitedBlueIds: ReadonlySet<string> = new Set<string>(),
  ): BlueNode {
    const nextVisitedBlueIds = this.withVisitedBlueId(
      visitedBlueIds,
      node.getBlueId(),
    );

    const type = node.getType();
    if (type) {
      node.setType(this.expandReferencedTypeNode(type, nextVisitedBlueIds));
    }

    const itemType = node.getItemType();
    if (itemType) {
      node.setItemType(
        this.expandReferencedTypeNode(itemType, nextVisitedBlueIds),
      );
    }

    const keyType = node.getKeyType();
    if (keyType) {
      node.setKeyType(
        this.expandReferencedTypeNode(keyType, nextVisitedBlueIds),
      );
    }

    const valueType = node.getValueType();
    if (valueType) {
      node.setValueType(
        this.expandReferencedTypeNode(valueType, nextVisitedBlueIds),
      );
    }

    const items = node.getItems();
    if (items) {
      node.setItems(
        items.map((item) =>
          this.expandSchemaTypeReferences(item, nextVisitedBlueIds),
        ),
      );
    }

    const properties = node.getProperties();
    if (properties) {
      node.setProperties(
        Object.fromEntries(
          Object.entries(properties).map(([key, value]) => [
            key,
            this.expandSchemaTypeReferences(value, nextVisitedBlueIds),
          ]),
        ),
      );
    }

    return node;
  }

  private expandReferencedTypeNode(
    typeNode: BlueNode,
    visitedBlueIds: ReadonlySet<string>,
  ): BlueNode {
    if (!this.isBareBlueIdReference(typeNode)) {
      return this.expandSchemaTypeReferences(typeNode.clone(), visitedBlueIds);
    }

    const referencedBlueId = typeNode.getBlueId();
    if (!referencedBlueId) {
      return typeNode.clone();
    }

    if (visitedBlueIds.has(referencedBlueId)) {
      return typeNode.clone();
    }

    const fetched = this.blue.getNodeProvider().fetchByBlueId(referencedBlueId);
    if (!fetched || fetched.length !== 1) {
      return typeNode.clone();
    }

    return this.expandSchemaTypeReferences(fetched[0].clone(), visitedBlueIds);
  }

  private withVisitedBlueId(
    visitedBlueIds: ReadonlySet<string>,
    blueId: string | undefined,
  ): ReadonlySet<string> {
    if (!blueId || visitedBlueIds.has(blueId)) {
      return visitedBlueIds;
    }

    const nextVisitedBlueIds = new Set(visitedBlueIds);
    nextVisitedBlueIds.add(blueId);
    return nextVisitedBlueIds;
  }
}
