import { BlueNode } from '../../model';
import { NodeProvider } from '../../NodeProvider';
import { MergingProcessor } from '../MergingProcessor';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import {
  isSubtype,
  isDictionaryType,
  isBasicType,
  isTextType,
  isIntegerType,
  isNumberType,
  isBooleanType,
} from './Types';

/**
 * Processes dictionary nodes, handling keyType and valueType
 */
export class DictionaryProcessor implements MergingProcessor {
  process(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider
  ): BlueNode {
    if (
      (source.getKeyType() !== undefined ||
        source.getValueType() !== undefined) &&
      !isDictionaryType(source.getType())
    ) {
      throw new Error(
        'Source node with keyType or valueType must have a Dictionary type'
      );
    }

    let newTarget = this.processKeyType(target, source, nodeProvider);
    newTarget = this.processValueType(newTarget, source, nodeProvider);

    // Validate properties against keyType and valueType
    const targetKeyType = newTarget.getKeyType();
    const targetValueType = newTarget.getValueType();
    const sourceProperties = source.getProperties();

    if (
      (targetKeyType !== undefined || targetValueType !== undefined) &&
      sourceProperties !== undefined
    ) {
      Object.entries(sourceProperties).forEach(([key, value]) => {
        if (targetKeyType !== undefined) {
          this.validateKeyType(key, targetKeyType, nodeProvider);
        }
        if (targetValueType !== undefined) {
          this.validateValueType(value, targetValueType, nodeProvider);
        }
      });
    }
    return newTarget;
  }

  private processKeyType(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider
  ): BlueNode {
    const targetKeyType = target.getKeyType();
    const sourceKeyType = source.getKeyType();

    if (targetKeyType === undefined) {
      if (sourceKeyType !== undefined) {
        this.validateBasicKeyType(sourceKeyType, nodeProvider);
        return target.clone().setKeyType(sourceKeyType);
      }
    } else if (sourceKeyType !== undefined) {
      this.validateBasicKeyType(sourceKeyType, nodeProvider);
      const isSubtypeResult = isSubtype(
        sourceKeyType,
        targetKeyType,
        nodeProvider
      );
      if (!isSubtypeResult) {
        const sourceKeyTypeStr = NodeToMapListOrValue.get(sourceKeyType);
        const targetKeyTypeStr = NodeToMapListOrValue.get(targetKeyType);
        throw new Error(
          `The source key type '${JSON.stringify(
            sourceKeyTypeStr
          )}' is not a subtype of the target key type '${JSON.stringify(
            targetKeyTypeStr
          )}'.`
        );
      }
      return target.clone().setKeyType(sourceKeyType);
    }
    return target;
  }

  private processValueType(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider
  ): BlueNode {
    const targetValueType = target.getValueType();
    const sourceValueType = source.getValueType();

    if (targetValueType === undefined) {
      if (sourceValueType !== undefined) {
        return target.clone().setValueType(sourceValueType);
      }
    } else if (sourceValueType !== undefined) {
      const isSubtypeResult = isSubtype(
        sourceValueType,
        targetValueType,
        nodeProvider
      );
      if (!isSubtypeResult) {
        const sourceValueTypeStr = NodeToMapListOrValue.get(sourceValueType);
        const targetValueTypeStr = NodeToMapListOrValue.get(targetValueType);
        throw new Error(
          `The source value type '${JSON.stringify(
            sourceValueTypeStr
          )}' is not a subtype of the target value type '${JSON.stringify(
            targetValueTypeStr
          )}'.`
        );
      }
      return target.clone().setValueType(sourceValueType);
    }
    return target;
  }

  private validateBasicKeyType(
    keyType: BlueNode,
    nodeProvider: NodeProvider
  ): void {
    if (!isBasicType(keyType, nodeProvider)) {
      throw new Error('Dictionary key type must be a basic type');
    }
  }

  private validateKeyType(
    key: string,
    keyType: BlueNode,
    nodeProvider: NodeProvider
  ): void {
    if (isTextType(keyType, nodeProvider)) {
      return;
    }

    if (isIntegerType(keyType, nodeProvider)) {
      const parsed = Number.parseInt(key, 10);
      if (Number.isNaN(parsed) || parsed.toString() !== key) {
        throw new Error(`Key '${key}' is not a valid Integer.`);
      }
    } else if (isNumberType(keyType, nodeProvider)) {
      const parsed = Number.parseFloat(key);
      if (Number.isNaN(parsed)) {
        throw new Error(`Key '${key}' is not a valid Number.`);
      }
    } else if (isBooleanType(keyType, nodeProvider)) {
      if (key.toLowerCase() !== 'true' && key.toLowerCase() !== 'false') {
        throw new Error(`Key '${key}' is not a valid Boolean.`);
      }
    } else {
      throw new Error(
        `Unsupported key type: ${keyType.getName() || 'unknown'}`
      );
    }
  }

  private validateValueType(
    value: BlueNode,
    valueType: BlueNode,
    nodeProvider: NodeProvider
  ): void {
    const nodeValueType = value.getType();
    if (
      nodeValueType !== undefined &&
      !isSubtype(nodeValueType, valueType, nodeProvider)
    ) {
      const valueTypeStr = NodeToMapListOrValue.get(nodeValueType);
      const expectedValueTypeStr = NodeToMapListOrValue.get(valueType);
      throw new Error(
        `Value of type '${JSON.stringify(
          valueTypeStr
        )}' is not a subtype of the dictionary's value type '${JSON.stringify(
          expectedValueTypeStr
        )}'.`
      );
    }
  }
}
