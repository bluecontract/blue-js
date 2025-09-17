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

  private extendAndResolve(node: BlueNode, limits: Limits): BlueNode {
    const extendedNode = node.clone();
    this.blue.extend(extendedNode, limits);
    return this.blue.resolve(extendedNode, limits);
  }

  private verifyMatch(
    resolvedNode: BlueNode,
    targetType: BlueNode,
    limits: Limits
  ): boolean {
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
    if (targetTypeType) {
      const nodeType = node.getType();
      if (
        !nodeType ||
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
    if (targetBlueId !== undefined && targetBlueId !== node.getBlueId()) {
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
      return true;
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
      return true;
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
}
