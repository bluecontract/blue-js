import { isArray } from 'radash';
import { NodeDeserializer, BlueIdCalculator } from '../../lib';
import { JsonBlueValue } from '../../types';

export const calculateBlueIdForJsonValue = async (value: JsonBlueValue) => {
  if (isArray(value)) {
    const nodes = value.map((v) => NodeDeserializer.deserialize(v));
    return BlueIdCalculator.calculateBlueIdForNodes(nodes);
  }

  const node = NodeDeserializer.deserialize(value);
  return BlueIdCalculator.calculateBlueId(node);
};
