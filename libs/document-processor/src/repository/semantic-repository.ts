import { repository as generatedBlueRepository } from '@blue-repository/types';
import type { blueIds as rawCoordinationBlueIds } from '@blue-repository/types/packages/coordination/blue-ids';
import type { blueIds as rawMyOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';
import type { blueIds as rawWorkflowsBlueIds } from '@blue-repository/types/packages/workflows/blue-ids';
import {
  BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID,
  Properties,
  type BlueRepository,
} from '@blue-labs/language';

const baseBlueRepository = generatedBlueRepository as BlueRepository;

type DefaultBlueIds = typeof Properties.DEFAULT_BLUE_TYPE_NAME_TO_BLUE_ID_MAP;

export const blueIds = Object.fromEntries(
  Object.entries(Properties.DEFAULT_BLUE_TYPE_NAME_TO_BLUE_ID_MAP),
) as DefaultBlueIds & Record<string, string>;
const generatedCoordinationBlueIds =
  packageAliases<typeof rawCoordinationBlueIds>('coordination');
export const workflowsBlueIds =
  packageAliases<typeof rawWorkflowsBlueIds>('workflows');

type WorkflowsBlueIds = typeof rawWorkflowsBlueIds;
type CoordinationWorkflowBlueIds = {
  readonly [K in keyof WorkflowsBlueIds as K extends `Workflows/${infer Name}`
    ? `Coordination/${Name}`
    : never]: WorkflowsBlueIds[K];
};

export const coordinationBlueIds = {
  ...generatedCoordinationBlueIds,
  ...prefixAliases(workflowsBlueIds, 'Workflows/', 'Coordination/'),
} as typeof rawCoordinationBlueIds &
  CoordinationWorkflowBlueIds &
  Record<string, string>;

type CoordinationBlueIds = typeof rawCoordinationBlueIds;
type ConversationBlueIds = {
  readonly [K in keyof CoordinationBlueIds as K extends `Coordination/${infer Name}`
    ? `Conversation/${Name}`
    : never]: CoordinationBlueIds[K];
} & {
  readonly [K in keyof WorkflowsBlueIds as K extends `Workflows/${infer Name}`
    ? `Conversation/${Name}`
    : never]: WorkflowsBlueIds[K];
};

export const conversationBlueIds = {
  ...prefixAliases(coordinationBlueIds, 'Coordination/', 'Conversation/'),
  ...prefixAliases(workflowsBlueIds, 'Workflows/', 'Conversation/'),
} as ConversationBlueIds & Record<string, string>;
export const myosBlueIds = packageAliases<typeof rawMyOsBlueIds>('myos');

const compatibilityContents = {
  ...BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID,
};

const runtimeTypesMeta = Object.fromEntries(
  Object.entries(compatibilityContents).map(([blueId, content]) => [
    blueId,
    {
      status: 'stable' as const,
      name: content.name as string,
      versions: [
        {
          repositoryVersionIndex: 0,
          typeBlueId: blueId,
          attributesAdded: [],
        },
      ],
    },
  ]),
);

export const blueRepository: BlueRepository = {
  ...baseBlueRepository,
  packages: {
    compatibility: {
      name: 'compatibility',
      aliases: {
        ...blueIds,
        ...conversationBlueIds,
        ...coordinationBlueIds,
      },
      typesMeta: runtimeTypesMeta,
      contents: compatibilityContents,
      schemas: {},
    },
    ...baseBlueRepository.packages,
  },
};

function packageAliases<T extends Record<string, string>>(
  packageName: string,
): T {
  const pkg = baseBlueRepository.packages[packageName];
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
