import type { JsonValue } from '@blue-labs/shared-utils';
import { Blue, BlueIdCalculator, Properties } from '@blue-labs/language';
import type { BlueRepository } from '@blue-labs/language';
import { repository as blueRepository } from '@blue-repository/types';

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

export function createBlueWithDerivedTypes(
  definitions: Array<{ name: string; yaml: string }>,
): { blue: Blue; derivedBlueIds: Record<string, string> } {
  const seedBlue = new Blue({
    repositories: [blueRepository, testFallbackRepository],
    mergingProcessor: createDefaultMergingProcessor(),
  });

  const types = definitions.map(({ name, yaml }) => {
    const node = seedBlue.yamlToNode(yaml);
    const blueId = BlueIdCalculator.calculateBlueIdSync(node);
    return { name, blueId, json: seedBlue.nodeToJson(node) };
  });

  const derivedRepository = buildDerivedTestRepository(types);
  const blue = new Blue({
    repositories: [blueRepository, testFallbackRepository, derivedRepository],
    mergingProcessor: createDefaultMergingProcessor(),
  });

  for (const { name, blueId } of types) {
    blue.registerBlueIds({ [name]: blueId });
  }

  return {
    blue,
    derivedBlueIds: Object.fromEntries(
      types.map(({ name, blueId }) => [name, blueId]),
    ),
  };
}

function buildDerivedTestRepository(
  types: Array<{ name: string; blueId: string; json: JsonValue }>,
): BlueRepository {
  const typesMeta = Object.fromEntries(
    types.map(({ name, blueId }) => [
      blueId,
      {
        status: 'stable' as const,
        name,
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
  const contents = Object.fromEntries(
    types.map(({ blueId, json }) => [blueId, json]),
  );

  return {
    name: 'test.derived.repo',
    repositoryVersions: ['R0'],
    packages: {
      derived: {
        name: 'derived',
        aliases: {},
        typesMeta,
        contents,
        schemas: {},
      },
    },
  };
}
