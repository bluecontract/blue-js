import { Blue, BlueNode } from '@blue-labs/language';
import { repository as blueRepository } from '@blue-repository/types';

import type { BlueValue } from '../types.js';

const blue = new Blue({
  repositories: [blueRepository],
});

export function toBlueNode(value: BlueValue): BlueNode {
  if (value instanceof BlueNode) {
    return value.clone();
  }
  return blue.jsonValueToNode(value);
}
