import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { withTypeBlueId } from '../../../schema/annotations';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { NodeToMapListOrValue } from '../NodeToMapListOrValue';
import { INTEGER_TYPE_BLUE_ID, TEXT_TYPE_BLUE_ID } from '../Properties';

describe('BlueNodeTypeSchema.integration', () => {
  it('matches exact types for base schemas without extension checks', () => {
    const { repository, schemas } = buildRepository();
    const blue = new Blue({ repositories: [repository] });

    const document = `
name: Request Document
type: payments/Request
requestId: abc-123`;

    const documentNode = blue.yamlToNode(document);
    const resolvedNode = blue.resolve(documentNode);

    const rawMatch = blue.isTypeOf(documentNode, schemas.request, {
      checkSchemaExtensions: false,
    });
    const resolvedMatch = blue.isTypeOf(resolvedNode, schemas.request, {
      checkSchemaExtensions: false,
    });
    const rawMatchWithExtensions = blue.isTypeOf(
      documentNode,
      schemas.request,
      { checkSchemaExtensions: true },
    );
    const resolvedMatchWithExtensions = blue.isTypeOf(
      resolvedNode,
      schemas.request,
      { checkSchemaExtensions: true },
    );

    expect([
      rawMatch,
      resolvedMatch,
      rawMatchWithExtensions,
      resolvedMatchWithExtensions,
    ]).toEqual([true, true, true, true]);
  });

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

  it('returns false when schema is missing a BlueId annotation', () => {
    const { repository } = buildRepository();
    const blue = new Blue({ repositories: [repository] });

    const document = `
name: Request Document
type: payments/Request
requestId: abc-123`;

    const documentNode = blue.yamlToNode(document);
    const unannotatedSchema = z.object({
      requestId: z.string(),
    });

    expect(blue.isTypeOf(documentNode, unannotatedSchema)).toBe(false);
  });

  it('maps historical BlueIds when resolving schema extensions', () => {
    const { repository, schemas, ids } = buildVersionedRepository();
    const blue = new Blue({ repositories: [repository] });

    const nodeTypeBv0 = new BlueNode().setType(
      new BlueNode().setBlueId(ids.typeBv0),
    );
    const nodeTypeAv0 = new BlueNode().setType(
      new BlueNode().setBlueId(ids.typeAv0),
    );
    const nodeTypeAv1 = new BlueNode().setType(
      new BlueNode().setBlueId(ids.typeAv1),
    );

    expect(
      blue.isTypeOf(nodeTypeBv0, schemas.typeAv1, {
        checkSchemaExtensions: true,
      }),
    ).toBe(true);
    expect(
      blue.isTypeOf(nodeTypeBv0, schemas.typeAv0, {
        checkSchemaExtensions: true,
      }),
    ).toBe(true);
    expect(
      blue.isTypeOf(nodeTypeAv0, schemas.typeAv1, {
        checkSchemaExtensions: true,
      }),
    ).toBe(true);
    expect(
      blue.isTypeOf(nodeTypeAv0, schemas.typeAv0, {
        checkSchemaExtensions: true,
      }),
    ).toBe(true);
    expect(blue.isTypeOf(nodeTypeAv1, schemas.typeAv0)).toBe(false);
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

function buildVersionedRepository() {
  const textType = () =>
    new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

  const typeAv0 = new BlueNode('TypeA').setProperties({
    label: textType(),
  });
  const typeAv1 = typeAv0.clone().addProperty('extra', textType());
  const typeAv0Id = BlueIdCalculator.calculateBlueIdSync(typeAv0);
  const typeAv1Id = BlueIdCalculator.calculateBlueIdSync(typeAv1);

  const typeBv0 = new BlueNode('TypeB')
    .setType(new BlueNode().setBlueId(typeAv0Id))
    .setProperties({
      title: textType(),
    });
  const typeBv1 = typeBv0
    .clone()
    .setType(new BlueNode().setBlueId(typeAv1Id));
  const typeBv0Id = BlueIdCalculator.calculateBlueIdSync(typeBv0);
  const typeBv1Id = BlueIdCalculator.calculateBlueIdSync(typeBv1);

  const schemaAv0 = withTypeBlueId(typeAv0Id)(
    z.object({
      label: z.string(),
    }),
  );
  const schemaAv1 = withTypeBlueId(typeAv1Id)(
    z.object({
      label: z.string(),
      extra: z.string().optional(),
    }),
  );
  const schemaBv1 = withTypeBlueId(typeBv1Id)(
    z.object({
      title: z.string(),
    }),
  );

  const repository = {
    name: 'versioned.repo',
    repositoryVersions: ['R0', 'R1'],
    packages: {
      core: {
        name: 'core',
        aliases: {
          'core/TypeA': typeAv1Id,
          'core/TypeB': typeBv1Id,
        },
        typesMeta: {
          [typeAv1Id]: {
            status: 'stable' as const,
            name: 'TypeA',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: typeAv0Id,
                attributesAdded: [],
              },
              {
                repositoryVersionIndex: 1,
                typeBlueId: typeAv1Id,
                attributesAdded: ['/extra'],
              },
            ],
          },
          [typeBv1Id]: {
            status: 'stable' as const,
            name: 'TypeB',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: typeBv0Id,
                attributesAdded: [],
              },
              {
                repositoryVersionIndex: 1,
                typeBlueId: typeBv1Id,
                attributesAdded: [],
              },
            ],
          },
        },
        contents: {
          [typeAv1Id]: NodeToMapListOrValue.get(typeAv1),
          [typeBv1Id]: NodeToMapListOrValue.get(typeBv1),
        },
        schemas: {
          [typeAv1Id]: schemaAv1,
          [typeBv1Id]: schemaBv1,
        },
      },
    },
  };

  return {
    repository,
    ids: {
      typeAv0: typeAv0Id,
      typeAv1: typeAv1Id,
      typeBv0: typeBv0Id,
      typeBv1: typeBv1Id,
    },
    schemas: {
      typeAv0: schemaAv0,
      typeAv1: schemaAv1,
    },
  };
}
