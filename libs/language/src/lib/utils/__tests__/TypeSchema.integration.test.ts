import { describe, it, expect } from 'vitest';
import { Blue } from '../../Blue';
import { repository as coreRepository } from '@blue-repository/core';
import {
  repository as conversationRepository,
  RequestSchema,
} from '@blue-repository/conversation';
import { repository as paynoteRepository } from '@blue-repository/paynote';

describe('BlueNodeTypeSchema.integration', () => {
  it('resolves inherited blueIds from registered repositories', () => {
    const blue = new Blue({
      repositories: [coreRepository, conversationRepository, paynoteRepository],
    });

    const document = `
        name: Test Document
        type: Capture Funds Requested
        requestId: abc-123
        amount: 100`;

    const documentNode = blue.yamlToNode(document);
    const resolvedNode = blue.resolve(documentNode);

    const documentIsRequest = blue.isTypeOf(documentNode, RequestSchema, {
      checkSchemaExtensions: false,
    });
    const documentIsEventWithExtension = blue.isTypeOf(
      documentNode,
      RequestSchema,
      { checkSchemaExtensions: true },
    );
    const resolvedIsRequest = blue.isTypeOf(resolvedNode, RequestSchema, {
      checkSchemaExtensions: false,
    });
    const resolvedIsRequestWithExtension = blue.isTypeOf(
      resolvedNode,
      RequestSchema,
      { checkSchemaExtensions: true },
    );

    expect([
      documentIsRequest,
      documentIsEventWithExtension,
      resolvedIsRequest,
      resolvedIsRequestWithExtension,
    ]).toEqual([false, true, false, true]);
  });
});
