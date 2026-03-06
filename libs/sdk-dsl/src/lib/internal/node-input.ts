import { Blue, BlueNode } from '@blue-labs/language';

import type { BlueValue } from '../types.js';

const blue = new Blue();

export function toBlueNode(value: BlueValue): BlueNode {
  if (value instanceof BlueNode) {
    return value.clone();
  }
  return blue.jsonValueToNode(value);
}
