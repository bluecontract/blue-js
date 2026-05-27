import { repository as blueRepository } from '@blue-repository/types';
import type { blueIds as rawCoreBlueIds } from '@blue-repository/types/packages/core/blue-ids';
import type { blueIds as rawCoordinationBlueIds } from '@blue-repository/types/packages/coordination/blue-ids';
import type { blueIds as rawMyOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';
import type { blueIds as rawWorkflowsBlueIds } from '@blue-repository/types/packages/workflows/blue-ids';
import { type BlueRepository } from '@blue-labs/language';

export { blueRepository };

export const blueIds = packageAliases<typeof rawCoreBlueIds>('core');
export const coordinationBlueIds =
  packageAliases<typeof rawCoordinationBlueIds>('coordination');
export const workflowsBlueIds =
  packageAliases<typeof rawWorkflowsBlueIds>('workflows');

type CoordinationBlueIds = typeof rawCoordinationBlueIds;
type ConversationBlueIds = {
  readonly [K in keyof CoordinationBlueIds as K extends `Coordination/${infer Name}`
    ? `Conversation/${Name}`
    : never]: CoordinationBlueIds[K];
} & {
  readonly 'Conversation/JavaScript Code': string;
  readonly 'Conversation/Change Workflow': string;
};

const LEGACY_JAVASCRIPT_CODE_BLUE_ID =
  'DhfsCuwERgEAGHDcTEvEVjhbBJV31BBYNz9iGZeGXT96';

export const conversationBlueIds = {
  ...prefixAliases(coordinationBlueIds, 'Coordination/', 'Conversation/'),
  'Conversation/Change Workflow': workflowsBlueIds['Workflows/Change Workflow'],
  'Conversation/JavaScript Code': LEGACY_JAVASCRIPT_CODE_BLUE_ID,
} as ConversationBlueIds & Record<string, string>;
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

function prefixAliases<T extends Record<string, string>>(
  aliases: T,
  fromPrefix: string,
  toPrefix: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(aliases)
      .filter(([name]) => name.startsWith(fromPrefix))
      .map(([name, blueId]) => [
        `${toPrefix}${name.slice(fromPrefix.length)}`,
        blueId,
      ]),
  );
}
