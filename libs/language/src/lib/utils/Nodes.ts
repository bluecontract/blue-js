import { BlueNode } from '../model';
import { isNonNullable } from '@blue-labs/shared-utils';
import {
  TEXT_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
} from './Properties';
import { BigIntegerNumber } from '../model/BigIntegerNumber';
import { BigDecimalNumber } from '../model/BigDecimalNumber';

/**
 * Available fields in a BlueNode
 */
export enum NodeField {
  NAME = 'NAME',
  DESCRIPTION = 'DESCRIPTION',
  TYPE = 'TYPE',
  BLUE_ID = 'BLUE_ID',
  KEY_TYPE = 'KEY_TYPE',
  VALUE_TYPE = 'VALUE_TYPE',
  ITEM_TYPE = 'ITEM_TYPE',
  VALUE = 'VALUE',
  PROPERTIES = 'PROPERTIES',
  BLUE = 'BLUE',
  ITEMS = 'ITEMS',
  CONTRACTS = 'CONTRACTS',
}

/**
 * Utility class for BlueNode operations
 */
export class Nodes {
  /**
   * Check if a node is empty (has no fields set)
   */
  static isEmptyNode(node: BlueNode): boolean {
    return this.hasFieldsAndMayHaveFields(node, new Set(), new Set());
  }

  /**
   * Check if a node has only a Blue ID
   */
  static hasBlueIdOnly(node: BlueNode): boolean {
    return this.hasFieldsAndMayHaveFields(
      node,
      new Set([NodeField.BLUE_ID]),
      new Set()
    );
  }

  /**
   * Check if a node has only items
   */
  static hasItemsOnly(node: BlueNode): boolean {
    return this.hasFieldsAndMayHaveFields(
      node,
      new Set([NodeField.ITEMS]),
      new Set()
    );
  }

  /**
   * Create a text node
   */
  static textNode(text: string): BlueNode {
    return new BlueNode()
      .setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
      .setValue(text);
  }

  /**
   * Create an integer node
   */
  static integerNode(number: BigIntegerNumber | number | string): BlueNode {
    const value =
      number instanceof BigIntegerNumber
        ? number
        : new BigIntegerNumber(number.toString());
    return new BlueNode()
      .setType(new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID))
      .setValue(value);
  }

  /**
   * Create a double node
   */
  static doubleNode(number: BigDecimalNumber | number | string): BlueNode {
    const value =
      number instanceof BigDecimalNumber
        ? number
        : new BigDecimalNumber(number.toString());
    return new BlueNode()
      .setType(new BlueNode().setBlueId(DOUBLE_TYPE_BLUE_ID))
      .setValue(value);
  }

  /**
   * Create a boolean node
   */
  static booleanNode(booleanValue: boolean): BlueNode {
    return new BlueNode()
      .setType(new BlueNode().setBlueId(BOOLEAN_TYPE_BLUE_ID))
      .setValue(booleanValue);
  }

  /**
   * Check if a node has exactly the specified fields
   * @param node - The node to check
   * @param mustHaveFields - Fields that must be present
   * @param mayHaveFields - Fields that may be present
   * @returns true if the node matches the field requirements
   */
  static hasFieldsAndMayHaveFields(
    node: BlueNode,
    mustHaveFields: Set<NodeField>,
    mayHaveFields: Set<NodeField>
  ): boolean {
    for (const field of Object.values(NodeField)) {
      const fieldIsPresent = isNonNullable(this.getFieldValue(node, field));

      if (mustHaveFields.has(field)) {
        if (!fieldIsPresent) return false;
      } else if (mayHaveFields.has(field)) {
        // This field may or may not be present, so we don't need to check
      } else {
        if (fieldIsPresent) return false;
      }
    }
    return true;
  }

  /**
   * Get the value of a field from a node
   */
  private static getFieldValue(node: BlueNode, field: NodeField): any {
    switch (field) {
      case NodeField.NAME:
        return node.getName();
      case NodeField.TYPE:
        return node.getType();
      case NodeField.VALUE:
        return node.getValue();
      case NodeField.DESCRIPTION:
        return node.getDescription();
      case NodeField.PROPERTIES:
        return node.getProperties();
      case NodeField.BLUE:
        return node.getBlue();
      case NodeField.ITEMS:
        return node.getItems();
      case NodeField.CONTRACTS:
        return node.getContracts();
      case NodeField.KEY_TYPE:
        return node.getKeyType();
      case NodeField.VALUE_TYPE:
        return node.getValueType();
      case NodeField.ITEM_TYPE:
        return node.getItemType();
      case NodeField.BLUE_ID:
        return node.getBlueId();
      default:
        throw new Error(`Unknown field: ${field}`);
    }
  }
}
