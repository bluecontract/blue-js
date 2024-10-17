import { isArray } from 'radash';
import { NodeDeserializer, BlueIdCalculator } from '../../lib';
import { JsonBlueValue } from '../../schema';

/**
 * Calculate the Blue ID for a JSON-like value
 * @param value - JSON-like value
 * @throws {Error} Invalid JSON-like value
 */
export const calculateBlueId = async (value: JsonBlueValue) => {
  if (isArray(value)) {
    const nodes = value.map((v) => NodeDeserializer.deserialize(v));
    return BlueIdCalculator.calculateBlueIdForNodes(nodes);
  }

  const node = NodeDeserializer.deserialize(value);
  return BlueIdCalculator.calculateBlueId(node);
};

/**
 * Calculate the Blue ID synchronously for a JSON-like value
 * @param value - JSON-like value
 * @throws {Error} Invalid JSON-like value
 */
export const calculateBlueIdSync = (value: JsonBlueValue) => {
  if (isArray(value)) {
    const nodes = value.map((v) => NodeDeserializer.deserialize(v));
    return BlueIdCalculator.calculateBlueIdSyncForNodes(nodes);
  }

  const node = NodeDeserializer.deserialize(value);
  return BlueIdCalculator.calculateBlueIdSync(node);
};
