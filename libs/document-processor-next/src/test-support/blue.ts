import { Blue } from '@blue-labs/language';
import {
  blueIds as coreBlueIds,
  repository as coreRepository,
} from '@blue-repository/core';

export function createBlue(): Blue {
  return new Blue({ repositories: [coreRepository] });
}

export const blueIds = coreBlueIds;
