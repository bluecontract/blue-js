import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { withTypeBlueId } from '../../../schema/annotations';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { NodeToMapListOrValue } from '../NodeToMapListOrValue';
import { INTEGER_TYPE_BLUE_ID, TEXT_TYPE_BLUE_ID } from '../Properties';

describe('BlueNodeTypeSchema.integration', () => {
  it('resolves inherited blueIds from registered repositories', () => {
    const { repository, schemas } = buildRepository();
    const blue = new Blue({
      repositories: [repository],
    });

    const document = `
name: Test Document
type: payments/CaptureFundsRequested
requestId: abc-123
amount: 100`;

    const documentNode = blue.yamlToNode(document);
    const resolvedNode = blue.resolve(documentNode);

    const documentIsRequest = blue.isTypeOf(documentNode, schemas.request, {
      checkSchemaExtensions: false,
    });
    const documentIsEventWithExtension = blue.isTypeOf(
      documentNode,
      schemas.request,
      { checkSchemaExtensions: true },
    );
    const resolvedIsRequest = blue.isTypeOf(resolvedNode, schemas.request, {
      checkSchemaExtensions: false,
    });
    const resolvedIsRequestWithExtension = blue.isTypeOf(
      resolvedNode,
      schemas.request,
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

function buildRepository() {
  const requestType = new BlueNode('Request').setProperties({
    requestId: new BlueNode().setType(
      new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID),
    ),
  });
  const requestBlueId = BlueIdCalculator.calculateBlueIdSync(requestType);

  const captureType = new BlueNode('CaptureFundsRequested')
    .setType(new BlueNode().setBlueId(requestBlueId))
    .setProperties({
      requestId: new BlueNode().setType(
        new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID),
      ),
      amount: new BlueNode().setType(
        new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID),
      ),
    });
  const captureBlueId = BlueIdCalculator.calculateBlueIdSync(captureType);

  const requestSchema = withTypeBlueId(requestBlueId)(
    z.object({
      requestId: z.string(),
    }),
  );
  const captureSchema = withTypeBlueId(captureBlueId)(
    z.object({
      requestId: z.string(),
      amount: z.number(),
    }),
  );

  const typesMeta = {
    [requestBlueId]: {
      status: 'stable' as const,
      name: 'Request',
      versions: [
        {
          repositoryVersionIndex: 0,
          typeBlueId: requestBlueId,
          attributesAdded: [],
        },
      ],
    },
    [captureBlueId]: {
      status: 'stable' as const,
      name: 'CaptureFundsRequested',
      versions: [
        {
          repositoryVersionIndex: 0,
          typeBlueId: captureBlueId,
          attributesAdded: [],
        },
      ],
    },
  };

  const repository = {
    name: 'test.repo',
    repositoryVersions: ['R0'],
    packages: {
      payments: {
        name: 'payments',
        aliases: {
          'payments/Request': requestBlueId,
          'payments/CaptureFundsRequested': captureBlueId,
        },
        typesMeta,
        contents: {
          [requestBlueId]: NodeToMapListOrValue.get(requestType),
          [captureBlueId]: NodeToMapListOrValue.get(captureType),
        },
        schemas: {
          [requestBlueId]: requestSchema,
          [captureBlueId]: captureSchema,
        },
      },
    },
  };

  return {
    repository,
    schemas: {
      request: requestSchema,
      capture: captureSchema,
    },
  };
}
