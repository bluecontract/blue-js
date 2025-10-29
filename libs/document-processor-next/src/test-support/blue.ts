import { Blue } from '@blue-labs/language';
import {
  blueIds as coreBlueIds,
  repository as coreRepository,
} from '@blue-repository/core';
import { repository as conversationRepository } from '@blue-repository/conversation';

export function createBlue(): Blue {
  return new Blue({ repositories: [coreRepository, conversationRepository] });
}

export const blueIds = coreBlueIds;
