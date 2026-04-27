import { repository as rawBlueRepository } from '@blue-repository/types';
import { blueIds as rawConversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as rawCoreBlueIds } from '@blue-repository/types/packages/core/blue-ids';
import { blueIds as rawMyOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';
import { createDefaultMergingProcessor } from '@blue-labs/document-processor';
import {
  reindexRepositoryForSemanticStorage,
  type BlueRepository,
} from '@blue-labs/language';

export const blueRepository = reindexRepositoryForSemanticStorage(
  rawBlueRepository,
  {
    mergingProcessor: createDefaultMergingProcessor(),
  },
);

export const blueIds = packageAliases<typeof rawCoreBlueIds>('core');
export const conversationBlueIds =
  packageAliases<typeof rawConversationBlueIds>('conversation');
export const myosBlueIds = packageAliases<typeof rawMyOsBlueIds>('myos');

function packageAliases<T extends Record<string, string>>(
  packageName: string,
): T {
  const pkg = (blueRepository as BlueRepository).packages[packageName];
  if (!pkg) {
    throw new Error(
      `Missing reindexed Blue repository package ${packageName}.`,
    );
  }
  return pkg.aliases as T;
}
