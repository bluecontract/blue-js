import { NodeDeserializer, NodeToObject } from '../../lib';
import { JsonBlueValue } from '../../schema';

export const normalizeToBlueObjectJson = (json: JsonBlueValue) => {
  const node = NodeDeserializer.deserialize(json ?? {});
  const blueObject = NodeToObject.get(node);

  return blueObject;
};

export const normalizeToBlueObject = (json: JsonBlueValue) => {
  const node = NodeDeserializer.deserialize(json ?? {});
  const blueObject = NodeToObject.getStandard(node);

  return blueObject;
};
