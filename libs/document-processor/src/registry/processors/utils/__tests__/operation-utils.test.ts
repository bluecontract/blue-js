import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';

import type { ContractProcessorContext } from '../../../types.js';
import { extractPinnedDocumentBlueId } from '../operation-utils.js';

describe('operation utils', () => {
  it('returns reference-only pinned document ids directly', () => {
    const requestNode = new BlueNode().setProperties({
      document: new BlueNode()
        .setReferenceBlueId('PinnedDocumentId')
        .setType(new BlueNode().setReferenceBlueId('DocumentType')),
    });
    const context = {
      blue: {
        calculateBlueIdSync: () => {
          throw new Error('semantic calculator should not run');
        },
      },
    } as unknown as ContractProcessorContext;

    expect(extractPinnedDocumentBlueId(requestNode, context)).toBe(
      'PinnedDocumentId',
    );
  });

  it('returns materialized pinned document reference ids directly', () => {
    const requestNode = new BlueNode().setProperties({
      document: new BlueNode()
        .setReferenceBlueId('ReferenceDocumentId')
        .setValue('payload'),
    });
    const context = {
      blue: {
        calculateBlueIdSync: () => {
          throw new Error('semantic calculator should not run');
        },
      },
    } as unknown as ContractProcessorContext;

    expect(extractPinnedDocumentBlueId(requestNode, context)).toBe(
      'ReferenceDocumentId',
    );
  });

  it('uses semantic calculated identity for inline pinned document payloads', () => {
    const requestNode = new BlueNode().setProperties({
      document: new BlueNode().setValue('payload'),
    });
    const context = {
      blue: {
        calculateBlueIdSync: () => 'semantic-document-id',
      },
    } as unknown as ContractProcessorContext;

    expect(extractPinnedDocumentBlueId(requestNode, context)).toBe(
      'semantic-document-id',
    );
  });
});
