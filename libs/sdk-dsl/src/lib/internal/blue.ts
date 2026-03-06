import { Blue } from '@blue-labs/language';
import { repository as blueRepository } from '@blue-repository/types';

export const INTERNAL_BLUE = new Blue({
  repositories: [blueRepository],
});
