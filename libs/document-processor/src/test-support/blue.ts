import { Blue } from '@blue-labs/language';
import type { BlueRepository } from '@blue-labs/language';
import {
  blueIds as coreBlueIds,
  repository as coreRepository,
} from '@blue-repository/core';
import { repository as conversationRepository } from '@blue-repository/conversation';
import { repository as myosRepository } from '@blue-repository/myos';

const FALLBACK_BLUE_IDS = [
  'AssertDocumentUpdate',
  'CutOffProbe',
  'EmitEvents',
  'IncrementProperty',
  'MutateEmbeddedPaths',
  'MutateEvent',
  'NotInitializationMarker',
  'RandomEvent',
  'RemoveIfPresent',
  'RemoveProperty',
  'SetPrice',
  'SetProperty',
  'SetPropertyOnEvent',
  'SomethingElse',
  'TerminateScope',
  'TestEvent',
  'TestEventChannel',
  'UnknownChannelType',
  'WrongMarker',
];

const fallbackBlueIdMap = Object.fromEntries(
  FALLBACK_BLUE_IDS.map((id) => [id, id]),
);
const fallbackContents = Object.fromEntries(
  FALLBACK_BLUE_IDS.map((id) => [
    id,
    {
      name: id,
      type: { blueId: coreBlueIds.Dictionary },
      properties: {},
    },
  ]),
);

const fallbackTypesMeta = Object.fromEntries(
  FALLBACK_BLUE_IDS.map((id) => [
    id,
    {
      status: 'stable' as const,
      name: id,
      versions: [
        { repositoryVersionIndex: 0, typeBlueId: id, attributesAdded: [] },
      ],
    },
  ]),
);

const fallbackToCurrentBlueIdIndex = Object.fromEntries(
  FALLBACK_BLUE_IDS.map((id) => [id, id]),
);

const testFallbackRepository: BlueRepository = {
  name: 'test.fallback.repo',
  repositoryVersions: ['R0'],
  repoVersionIndexById: { R0: 0 },
  packages: {
    fallback: {
      name: 'fallback',
      aliases: fallbackBlueIdMap,
      typesMeta: fallbackTypesMeta,
      types: fallbackTypesMeta,
      toCurrentBlueIdIndex: fallbackToCurrentBlueIdIndex,
      contents: fallbackContents,
      schemas: {},
    },
  },
};

export function createBlue(): Blue {
  return new Blue({
    repositories: [
      coreRepository,
      conversationRepository,
      myosRepository,
      testFallbackRepository,
    ],
  });
}

export const blueIds = coreBlueIds;
