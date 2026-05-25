import { repository as blueRepository } from '@blue-repository/types';
import type { blueIds as rawCoreBlueIds } from '@blue-repository/types/packages/core/blue-ids';
import type { blueIds as rawConversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import type { blueIds as rawMyOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';
import { type BlueRepository } from '@blue-labs/language';

export { blueRepository };

export const blueIds = packageAliases<typeof rawCoreBlueIds>('core');
const generatedConversationBlueIds =
  packageAliases<Record<string, string>>('conversation');
type ConversationComputeAliases =
  | 'Conversation/Compute'
  | 'Conversation/Compute Definition';
export const conversationBlueIds = {
  ...generatedConversationBlueIds,
  // Transitional aliases verified from blue-repository/BlueRepository.blue.
  // The generated npm artifact should provide these directly once its
  // conversation package is in sync with the source repository.
  'Conversation/Compute':
    generatedConversationBlueIds['Conversation/Compute'] ??
    '43pL2gQm5LahhsD7wGhTRxdH8DyfSEvpe2xx2rW2PHJS',
  'Conversation/Compute Definition':
    generatedConversationBlueIds['Conversation/Compute Definition'] ??
    '4fwPW7iJA5p7MuRhc3xpn43EsU3TkruGRpujcuwDGbw3',
} as typeof rawConversationBlueIds & Record<ConversationComputeAliases, string>;
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
