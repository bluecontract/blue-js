import { Blue, Properties, type BlueRepository } from '@blue-labs/language';
import { createDefaultMergingProcessor } from '@blue-labs/document-processor';
import { repository as blueRepository } from '@blue-repository/types';

const customTypeBlueId = 'sdkDslCustomTypeBlueId';

const customParityRepository: BlueRepository = {
  name: 'sdk.dsl.stage1.parity',
  repositoryVersions: ['R0'],
  packages: {
    parity: {
      name: 'parity',
      aliases: {
        'Custom/Type': customTypeBlueId,
      },
      typesMeta: {
        [customTypeBlueId]: {
          status: 'stable',
          name: 'Custom/Type',
          versions: [
            {
              repositoryVersionIndex: 0,
              typeBlueId: customTypeBlueId,
              attributesAdded: [],
            },
          ],
        },
      },
      contents: {
        [customTypeBlueId]: {
          name: 'Custom/Type',
          type: {
            blueId: Properties.DICTIONARY_TYPE_BLUE_ID,
          },
          properties: {},
        },
      },
      schemas: {},
    },
  },
};

export function createTestBlue(): Blue {
  return new Blue({
    repositories: [blueRepository, customParityRepository],
    mergingProcessor: createDefaultMergingProcessor(),
  });
}
