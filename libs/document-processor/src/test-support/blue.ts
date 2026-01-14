import { Blue, Properties } from '@blue-labs/language';
import type { BlueRepository } from '@blue-labs/language';
import { repository as blueRepository } from '@blue-repository/types';
import { blueIds as coreBlueIds } from '@blue-repository/types/packages/core/blue-ids';
import { createDefaultMergingProcessor } from '../merge/utils/default.js';

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
      type: { blueId: Properties.DICTIONARY_TYPE_BLUE_ID },
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

const testFallbackRepository: BlueRepository = {
  name: 'test.fallback.repo',
  repositoryVersions: ['R0'],
  packages: {
    fallback: {
      name: 'fallback',
      aliases: fallbackBlueIdMap,
      typesMeta: fallbackTypesMeta,
      contents: fallbackContents,
      schemas: {},
    },
  },
};

export function createBlue(): Blue {
  return new Blue({
    repositories: [blueRepository, testFallbackRepository],
    mergingProcessor: createDefaultMergingProcessor(),
  });
}

export const blueIds = coreBlueIds;
