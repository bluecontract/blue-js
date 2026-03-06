import { Blue } from '@blue-labs/language';
import { createDefaultMergingProcessor } from '@blue-labs/document-processor';
import { repository as blueRepository } from '@blue-repository/types';

export function createTestBlue(): Blue {
  return new Blue({
    repositories: [blueRepository],
    mergingProcessor: createDefaultMergingProcessor(),
  });
}
