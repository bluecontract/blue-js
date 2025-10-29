import { isArray } from 'radash';
import { NodeDeserializer, BlueIdCalculator } from '../../lib';
import { JsonBlueValue } from '../../schema';
import { BlueNode } from '../../lib/model/Node';

/**
 * Internal helper to prepare input for BlueId calculation
 * @param value - JSON-like value, BlueNode, or array of BlueNodes
 * @returns Value ready for BlueId calculation
 */
const prepareForBlueIdCalculation = (
  value: JsonBlueValue | BlueNode | BlueNode[],
): BlueNode | BlueNode[] => {
  if (value instanceof BlueNode) {
    return value;
  }

  if (Array.isArray(value) && value.every((v) => v instanceof BlueNode)) {
    return value;
  }

  if (isArray(value)) {
    return value.map((v) => NodeDeserializer.deserialize(v));
  }

  return NodeDeserializer.deserialize(value);
};

/**
 * Calculate the Blue ID for a JSON-like value, BlueNode, or array of BlueNodes
 * @param value - JSON-like value, BlueNode, or array of BlueNodes
 * @throws {Error} Invalid input value
 */
export const calculateBlueId = async (
  value: JsonBlueValue | BlueNode | BlueNode[],
) => {
  const prepared = prepareForBlueIdCalculation(value);
  return BlueIdCalculator.calculateBlueId(prepared);
};

/**
 * Calculate the Blue ID synchronously for a JSON-like value, BlueNode, or array of BlueNodes
 * @param value - JSON-like value, BlueNode, or array of BlueNodes
 * @throws {Error} Invalid input value
 */
export const calculateBlueIdSync = (
  value: JsonBlueValue | BlueNode | BlueNode[],
) => {
  const prepared = prepareForBlueIdCalculation(value);
  return BlueIdCalculator.calculateBlueIdSync(prepared);
};
