import { BlueNode } from './Node';
import { BlueId } from '../utils/BlueId';
import { JsonBlueValue } from '../../types';
import {
  OBJECT_BLUE_ID,
  OBJECT_DESCRIPTION,
  OBJECT_ITEMS,
  OBJECT_NAME,
  OBJECT_REF,
  OBJECT_TYPE,
  OBJECT_VALUE,
} from '../utils/Properties';
import { isBigNumber, isJsonBluePrimitive } from '../../utils/typeGuards';

export class NodeDeserializer {
  static deserialize(json: JsonBlueValue): BlueNode {
    return NodeDeserializer.handleNode(json);
  }

  private static handleNode(node: JsonBlueValue): BlueNode {
    if (typeof node === 'string' && BlueId.isPotentialBlueId(node)) {
      return new BlueNode().setBlueId(node);
    } else if (isJsonBluePrimitive(node) || isBigNumber(node)) {
      return new BlueNode().setValue(node);
    } else if (Array.isArray(node)) {
      return NodeDeserializer.handleArray(node);
    } else {
      const obj = new BlueNode();
      Object.entries(node).forEach(([key, value]) => {
        switch (key) {
          case OBJECT_NAME:
            if (typeof value !== 'string') {
              throw new Error(`The ${OBJECT_NAME} field must be a string.`);
            }
            obj.setName(value);
            break;
          case OBJECT_DESCRIPTION:
            if (typeof value !== 'string') {
              throw new Error(
                `The ${OBJECT_DESCRIPTION} field must be a string.`
              );
            }
            obj.setDescription(value);
            break;
          case OBJECT_TYPE:
            obj.setType(NodeDeserializer.handleType(value));
            break;
          case OBJECT_VALUE:
            if (!isJsonBluePrimitive(value) && !isBigNumber(value)) {
              throw new Error(
                `The ${OBJECT_VALUE} field must be a primitive or instance of Big class.`
              );
            }
            obj.setValue(value);
            break;
          case OBJECT_BLUE_ID:
            if (typeof value !== 'string') {
              throw new Error(`The ${OBJECT_BLUE_ID} field must be a string.`);
            }
            obj.setBlueId(value);
            break;
          case OBJECT_REF:
            if (typeof value !== 'string') {
              throw new Error(`The ${OBJECT_REF} field must be a string.`);
            }
            obj.setRef(value);
            break;
          case OBJECT_ITEMS:
            obj.setItems(NodeDeserializer.handleArray(value).getItems() ?? []);
            break;
          // TODO: Implement constraints
          // case OBJECT_CONSTRAINTS:
          //   obj.setConstraints(NodeDeserializer.handleConstraints(value));
          //   break;
          default:
            obj.addProperty(key, NodeDeserializer.handleNode(value));
            break;
        }
      });
      return obj;
    }
  }

  private static handleType(value: JsonBlueValue): BlueNode {
    if (typeof value === 'string') {
      return BlueId.isPotentialBlueId(value)
        ? new BlueNode().setBlueId(value)
        : new BlueNode().setName(value);
    } else {
      return NodeDeserializer.handleNode(value);
    }
  }

  private static handleArray(value: JsonBlueValue): BlueNode {
    if (typeof value === 'string' && BlueId.isPotentialBlueId(value)) {
      const singleItemList = [new BlueNode().setBlueId(value)];
      return new BlueNode().setItems(singleItemList);
    } else if (Array.isArray(value)) {
      const result = value.map(NodeDeserializer.handleNode);
      return new BlueNode().setItems(result);
    } else {
      throw new Error("The 'items' field must be an array or a blueId.");
    }
  }

  // TODO: Implement constraints
  // private static handleConstraints(constraintsNode: any): Constraints {
  //   return plainToClass(Constraints, constraintsNode);
  // }
}
