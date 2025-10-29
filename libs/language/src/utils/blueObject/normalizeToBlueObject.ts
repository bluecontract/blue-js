import { NodeDeserializer, NodeToMapListOrValue } from '../../lib';
import { blueObjectSchema, JsonBlueValue } from '../../schema';

/**
 * Normalize JSON-like value to BlueObject
 *
 * @param json - JSON-like value
 * @returns blue object
 * @throws {Error} When failed to transform JSON-like value to BlueObject
 */
export const normalizeToBlueObject = (json: JsonBlueValue) => {
  try {
    const node = NodeDeserializer.deserialize(json);
    const jsonBlueObject = NodeToMapListOrValue.get(node);
    return blueObjectSchema.parse(jsonBlueObject);
  } catch (error) {
    throw new Error(
      `Failed transforming JSON-like value to BlueObject: ${error}`,
    );
  }
};
