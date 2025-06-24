import { deepFreeze } from '@blue-labs/shared-utils';
import { DocumentNode } from '../types';
import { ENABLE_IMMUTABILITY } from './document';
import { isDocumentNode } from './typeGuard';
import { Blue } from '@blue-labs/language';
import { blueIds, InitializedMarkerSchema } from '@blue-repository/core-dev';

export function ensureInitializedContract(
  doc: DocumentNode,
  blue: Blue
): DocumentNode {
  const cloned = doc.clone();

  if (!isDocumentNode(cloned)) {
    return ENABLE_IMMUTABILITY ? deepFreeze(cloned) : cloned;
  }

  if (!isInitialized(cloned, blue)) {
    cloned.addContract(
      'initialized',
      blue.jsonValueToNode({
        type: {
          name: 'Initialized Marker',
          blueId: blueIds['Initialized Marker'],
        },
      })
    );
  }

  return ENABLE_IMMUTABILITY ? deepFreeze(cloned) : cloned;
}

export function isInitialized(doc: DocumentNode, blue: Blue): boolean {
  const contracts = doc.getContracts();
  return Object.values(contracts ?? {}).some((contract) =>
    blue.isTypeOf(contract, InitializedMarkerSchema, {
      checkSchemaExtensions: true,
    })
  );
}
