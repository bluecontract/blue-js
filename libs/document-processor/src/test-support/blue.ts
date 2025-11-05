import { Blue } from '@blue-labs/language';
import {
  blueIds as coreBlueIds,
  repository as coreRepository,
} from '@blue-repository/core';
import { repository as conversationRepository } from '@blue-repository/conversation';
import { repository as myosRepository } from '@blue-repository/myos';

export function createBlue(): Blue {
  return new Blue({
    repositories: [coreRepository, conversationRepository, myosRepository],
  });
}

export const blueIds = coreBlueIds;
