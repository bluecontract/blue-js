import { isArray } from 'radash';
import { NodeDeserializer, BlueIdCalculator } from '../../lib';
import { jsonBlueValueSchema } from '../../schema';

/**
 * Calculate the Blue ID for a JSON-like value
 * @param jsonLikeValue
 * @throws {Error} Invalid JSON-like value
 */
export const calculateBlueId = async (jsonLikeValue: unknown) => {
  const jsonBlueValueResult = jsonBlueValueSchema.safeParse(jsonLikeValue);

  if (!jsonBlueValueResult.success) {
    throw new Error('Invalid JSON-like value');
  }

  const value = jsonBlueValueResult.data;

  if (isArray(value)) {
    const nodes = value.map((v) => NodeDeserializer.deserialize(v));
    return BlueIdCalculator.calculateBlueIdForNodes(nodes);
  }

  const node = NodeDeserializer.deserialize(value);
  return BlueIdCalculator.calculateBlueId(node);
};
