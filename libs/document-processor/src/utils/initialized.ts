import { DocumentNode } from '../types';
import { freeze, mutable } from './document';
import { isDocumentNode } from './typeGuard';
import { Blue } from '@blue-labs/language';
import { blueIds, InitializedMarkerSchema } from '@blue-repository/core-dev';

export function ensureInitializedContract(
  doc: DocumentNode,
  blue: Blue,
): DocumentNode {
  const mutableDoc = mutable(doc);

  if (!isDocumentNode(mutableDoc)) {
    // Return frozen document
    return freeze(mutableDoc);
  }

  if (!isInitialized(mutableDoc, blue)) {
    mutableDoc.addContract(
      'initialized',
      blue.jsonValueToNode({
        type: {
          name: 'Initialized Marker',
          blueId: blueIds['Initialized Marker'],
        },
      }),
    );
  }

  // Return frozen document
  return freeze(mutableDoc);
}

export function isInitialized(doc: DocumentNode, blue: Blue): boolean {
  const contracts = doc.getContracts();
  return Object.values(contracts ?? {}).some((contract) =>
    blue.isTypeOf(contract, InitializedMarkerSchema, {
      checkSchemaExtensions: true,
    }),
  );
}
