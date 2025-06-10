import { deepFreeze } from '@blue-labs/shared-utils';
import { DocumentNode } from '../types';
import { ENABLE_IMMUTABILITY } from './document';
import { isDocumentNode } from './typeGuard';
import { Blue } from '@blue-labs/language';
import { mockBlueIds } from '../mocks/blueIds';

export function ensureInitializedContract(
  doc: DocumentNode,
  blue: Blue
): DocumentNode {
  const cloned = doc.clone();

  if (!isDocumentNode(cloned)) {
    return ENABLE_IMMUTABILITY ? deepFreeze(cloned) : cloned;
  }

  const contracts = cloned.getContracts();

  if (!contracts?.initialized) {
    cloned.addContract(
      'initialized',
      blue.jsonValueToNode({
        type: {
          name: 'Initialized Marker',
          blueId: mockBlueIds['Initialized Marker'],
        },
      })
    );
  }

  return ENABLE_IMMUTABILITY ? deepFreeze(cloned) : cloned;
}
