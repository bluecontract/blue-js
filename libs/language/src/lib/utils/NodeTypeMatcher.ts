import { Blue } from '../Blue';
import { BlueNode } from '../model';
import { CompositeLimits, Limits, NO_LIMITS, PathLimits } from './limits';
import { isBigNumber } from '../../utils/typeGuards/isBigNumber';
import { NodeTypes } from './index';

export class NodeTypeMatcher {
  private blue: Blue;

  constructor(blue: Blue) {
    this.blue = blue;
  }

  public matchesType(
    node: BlueNode,
    targetType: BlueNode,
    globalLimits: Limits = NO_LIMITS
  ): boolean {
    // Quick structural match for implicit core types (List/Dictionary)
    const quickTargetType = targetType.getType();
    if (this.matchesImplicitStructure(node, quickTargetType)) {
      return true;
    }

    // Derive path limits from the target type structure
    const pathLimits = PathLimits.fromNode(targetType);
    const compositeLimits = CompositeLimits.of(globalLimits, pathLimits);

    const resolvedNode = this.extendAndResolve(node, compositeLimits);
    const resolvedType = this.blue.resolve(targetType, compositeLimits);

    return (
      this.verifyMatch(resolvedNode, targetType, compositeLimits) &&
      this.recursiveValueComparison(resolvedNode, resolvedType)
    );
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
    limits: Limits
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
    targetType: BlueNode
  ): boolean {
    const targetTypeType = targetType.getType();
    const isImplicitStructureMatch = this.matchesImplicitStructure(
      node,
      targetTypeType
    );
    if (targetTypeType && !isImplicitStructureMatch) {
      const nodeType = node.getType();
      if (!nodeType) {
        return false;
      }
      if (
        !NodeTypes.isSubtype(
          nodeType,
          targetTypeType,
          this.blue.getNodeProvider()
        )
      ) {
        return false;
      }
    }

    const targetBlueId = targetType.getBlueId();
    if (!isImplicitStructureMatch) {
      if (targetBlueId !== undefined) {
        const nodeBlueId = node.getBlueId();
        const nodeTypeBlueId = node.getType()?.getBlueId();
        if (nodeBlueId !== undefined) {
          if (targetBlueId !== nodeBlueId) {
            return false;
          }
        } else {
          if (nodeTypeBlueId === undefined) {
            return false;
          }
          if (targetBlueId !== nodeTypeBlueId) {
            return false;
          }
        }
      }
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
    if (targetItems !== undefined) {
      const nodeItems = node.getItems() ?? [];
      for (let i = 0; i < targetItems.length; i++) {
        if (i < nodeItems.length) {
          if (!this.recursiveValueComparison(nodeItems[i], targetItems[i])) {
            return false;
          }
        } else {
          if (this.hasValueInNestedStructure(targetItems[i])) {
            return false;
          }
        }
      }
      // no need to check extra items on node
    }

    const targetItemType = targetType.getItemType();
    if (targetItemType !== undefined) {
      const nodeItems = node.getItems() ?? [];
      for (const item of nodeItems) {
        if (!this.recursiveValueComparison(item, targetItemType)) {
          return false;
        }
      }
    }

    const targetProps = targetType.getProperties();
    if (targetProps !== undefined) {
      const nodeProps = node.getProperties() ?? {};
      for (const [key, value] of Object.entries(targetProps)) {
        if (key in nodeProps) {
          if (!this.recursiveValueComparison(nodeProps[key], value)) {
            return false;
          }
        } else {
          if (this.hasValueInNestedStructure(value)) {
            return false;
          }
        }
      }
    }

    const targetValueType = targetType.getValueType();
    if (targetValueType !== undefined) {
      const nodeProps = Object.values(node.getProperties() ?? {});
      for (const value of nodeProps) {
        if (!this.recursiveValueComparison(value, targetValueType)) {
          return false;
        }
      }
    }

    return true;
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

  /**
   * Determines whether a node without an explicit type already satisfies the
   * shape of the requested core list or dictionary type.
   */
  private matchesImplicitStructure(
    node: BlueNode,
    targetTypeType: BlueNode | undefined
  ): boolean {
    if (targetTypeType === undefined || node.getType() !== undefined) {
      return false;
    }

    if (NodeTypes.isListType(targetTypeType)) {
      return this.isImplicitListStructure(node);
    }

    if (NodeTypes.isDictionaryType(targetTypeType)) {
      return this.isImplicitDictionaryStructure(node);
    }

    return false;
  }

  private isImplicitListStructure(node: BlueNode): boolean {
    return node.getItems() !== undefined && node.getValue() === undefined;
  }

  private isImplicitDictionaryStructure(node: BlueNode): boolean {
    return node.getProperties() !== undefined && node.getValue() === undefined;
  }
}
