import { repository as blueRepository } from '@blue-repository/types';
import type { blueIds as rawCoreBlueIds } from '@blue-repository/types/packages/core/blue-ids';
import type { blueIds as rawConversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import type { blueIds as rawMyOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';
import { type BlueRepository } from '@blue-labs/language';

export { blueRepository };

export const blueIds = packageAliases<typeof rawCoreBlueIds>('core');
export const conversationBlueIds =
  packageAliases<typeof rawConversationBlueIds>('conversation');
export const myosBlueIds = packageAliases<typeof rawMyOsBlueIds>('myos');

function packageAliases<T extends Record<string, string>>(
  packageName: string,
): T {
  const pkg = (blueRepository as BlueRepository).packages[packageName];
  if (!pkg) {
    throw new Error(`Missing Blue repository package ${packageName}.`);
  }
  return pkg.aliases as T;
}
