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
export const NODE_FIELDS = {
  NAME: 'name',
  DESCRIPTION: 'description',
  TYPE: 'type',
  BLUE_ID: 'blue_id',
  KEY_TYPE: 'key_type',
  VALUE_TYPE: 'value_type',
  ITEM_TYPE: 'item_type',
  VALUE: 'value',
  PROPERTIES: 'properties',
  BLUE: 'blue',
  ITEMS: 'items',
  CONTRACTS: 'contracts',
} as const;

export type NodeField = (typeof NODE_FIELDS)[keyof typeof NODE_FIELDS];

/**
 * Utility class for BlueNode operations
 */
export class Nodes {
  /**
   * Check if a node is empty (has no fields set)
   */
  static isEmptyNode(node: BlueNode): boolean {
    return this.hasFieldsAndMayHaveFields(node);
  }

  /**
   * Check if a node has only a Blue ID
   */
  static hasBlueIdOnly(node: BlueNode): boolean {
    return this.hasFieldsAndMayHaveFields(node, new Set([NODE_FIELDS.BLUE_ID]));
  }

  /**
   * Check if a node has only items
   */
  static hasItemsOnly(node: BlueNode): boolean {
    return this.hasFieldsAndMayHaveFields(node, new Set([NODE_FIELDS.ITEMS]));
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
    mustHaveFields: Set<NodeField> = new Set(),
    mayHaveFields: Set<NodeField> = new Set()
  ): boolean {
    for (const field of Object.values(NODE_FIELDS)) {
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
  private static getFieldValue(node: BlueNode, field: NodeField) {
    switch (field) {
      case NODE_FIELDS.NAME:
        return node.getName();
      case NODE_FIELDS.TYPE:
        return node.getType();
      case NODE_FIELDS.VALUE:
        return node.getValue();
      case NODE_FIELDS.DESCRIPTION:
        return node.getDescription();
      case NODE_FIELDS.PROPERTIES:
        return node.getProperties();
      case NODE_FIELDS.BLUE:
        return node.getBlue();
      case NODE_FIELDS.ITEMS:
        return node.getItems();
      case NODE_FIELDS.CONTRACTS:
        return node.getContracts();
      case NODE_FIELDS.KEY_TYPE:
        return node.getKeyType();
      case NODE_FIELDS.VALUE_TYPE:
        return node.getValueType();
      case NODE_FIELDS.ITEM_TYPE:
        return node.getItemType();
      case NODE_FIELDS.BLUE_ID:
        return node.getBlueId();
      default:
        throw new Error(`Unknown field: ${field}`);
    }
  }
}
