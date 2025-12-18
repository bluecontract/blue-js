import { expect } from 'vitest';
import { z } from 'zod';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import { withTypeBlueId } from '../../../schema/annotations';
import { BlueError, BlueErrorCode } from '../../errors/BlueError';
import type { VersionedBlueRepository } from '../../types/BlueRepository';
import {
  DICTIONARY_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../../utils/Properties';

export const fixtures = buildRepositoryFixtures();
export const repoBlue = fixtures.repository;
export const otherRepository = fixtures.otherRepository;
export const ids = fixtures.ids;
export const repositoryVersions = fixtures.repositoryVersions;
export const fixtureSchemas = fixtures.fixtureSchemas;

export function createBlueInstance() {
  return new Blue({ repositories: [repoBlue, otherRepository] });
}

export function expectBlueError(
  err: unknown,
  options: {
    code: BlueErrorCode;
    contextContains?: Record<string, unknown>;
    messageIncludes?: string;
  },
) {
  expect(err).toBeInstanceOf(BlueError);
  const error = err as BlueError;
  expect(error.code).toEqual(options.code);
  if (options.messageIncludes) {
    expect(error.message).toContain(options.messageIncludes);
  }
  if (options.contextContains) {
    const ctx = (error.details[0]?.context ?? {}) as Record<string, unknown>;
    for (const [key, expected] of Object.entries(options.contextContains)) {
      expect(ctx[key]).toEqual(expected);
    }
  }
}

export function textValue(value: string) {
  return new BlueNode()
    .setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
    .setValue(value);
}

export function buildInlineRepository(options: {
  pointer: string;
  buildContainer: (subtype: BlueNode) => BlueNode;
}) {
  const repositoryVersions = ['R0', 'R1'] as const;

  const baseSubtype = new BlueNode().setProperties({
    prop1: new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
  });
  const evolvedSubtype = baseSubtype
    .clone()
    .addProperty(
      'prop2',
      new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
    );

  const oldContainer = options.buildContainer(baseSubtype);
  const newContainer = options.buildContainer(evolvedSubtype);

  const containerOldId = BlueIdCalculator.calculateBlueIdSync(oldContainer);
  const containerNewId = BlueIdCalculator.calculateBlueIdSync(newContainer);

  return {
    name: 'repo.blue',
    repositoryVersions,
    packages: {
      core: {
        name: 'core',
        aliases: {
          [`core/${newContainer.getName()}`]: containerNewId,
        },
        typesMeta: {
          [containerNewId]: {
            status: 'stable' as const,
            name: newContainer.getName() || 'Inline',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: containerOldId,
                attributesAdded: [],
              },
              {
                repositoryVersionIndex: 1,
                typeBlueId: containerNewId,
                attributesAdded: [options.pointer],
              },
            ],
          },
        },
        contents: {
          [containerNewId]: NodeToMapListOrValue.get(newContainer),
        },
        schemas: {},
      },
    },
  };
}

export function buildTypedRepository() {
  const repositoryVersions = ['R0', 'R1'] as const;

  const textId = TEXT_TYPE_BLUE_ID;

  const ruleBase = new BlueNode('Rule').setProperties({
    field: new BlueNode().setProperties({
      nested: new BlueNode().setType(new BlueNode().setBlueId(textId)),
    }),
    metadata: new BlueNode().setProperties({
      notes: new BlueNode().setType(new BlueNode().setBlueId(textId)),
    }),
  });
  const ruleHistoric = ruleBase;
  const ruleHistoricId = BlueIdCalculator.calculateBlueIdSync(ruleHistoric);

  const ruleBaseProps = ruleBase.getProperties();
  if (!ruleBaseProps) {
    throw new Error('expected ruleBase to have properties');
  }

  const ruleCurrent = ruleBase.clone().setProperties({
    ...ruleBaseProps,
    metadata: ruleBaseProps.metadata
      .clone()
      .addProperty(
        'flags',
        new BlueNode().setType(new BlueNode().setBlueId(textId)),
      ),
    field: ruleBaseProps.field
      .clone()
      .addProperty(
        'nested2',
        new BlueNode().setType(new BlueNode().setBlueId(textId)),
      ),
  });
  const ruleCurrentId = BlueIdCalculator.calculateBlueIdSync(ruleCurrent);

  const container = new BlueNode('Container').setProperties({
    listOfDicts: new BlueNode()
      .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
      .setItemType(
        new BlueNode()
          .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
          .setKeyType(new BlueNode().setBlueId(textId))
          .setValueType(new BlueNode().setBlueId(ruleCurrentId)),
      )
      .setItems([
        new BlueNode()
          .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
          .setKeyType(new BlueNode().setBlueId(textId))
          .setValueType(new BlueNode().setBlueId(ruleCurrentId))
          .setProperties({
            first: new BlueNode()
              .setType(new BlueNode().setBlueId(ruleCurrentId))
              .setProperties({
                field: new BlueNode().setProperties({
                  nested: textValue('keep'),
                  nested2: textValue('drop'),
                }),
                metadata: new BlueNode().setProperties({
                  notes: textValue('note'),
                  flags: textValue('flag'),
                }),
              }),
          }),
      ]),
  });

  const containerHistoric = container.clone();
  const containerHistoricId =
    BlueIdCalculator.calculateBlueIdSync(containerHistoric);
  const containerCurrentId = BlueIdCalculator.calculateBlueIdSync(container);

  const repository: VersionedBlueRepository = {
    name: 'repo.blue',
    repositoryVersions,
    packages: {
      core: {
        name: 'core',
        aliases: {
          'core/Rule': ruleCurrentId,
          'core/Container': containerCurrentId,
        },
        typesMeta: {
          [ruleCurrentId]: {
            status: 'stable' as const,
            name: 'Rule',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: ruleHistoricId,
                attributesAdded: [],
              },
              {
                repositoryVersionIndex: 1,
                typeBlueId: ruleCurrentId,
                attributesAdded: ['/metadata/flags', '/field/nested2'],
              },
            ],
          },
          [containerCurrentId]: {
            status: 'stable' as const,
            name: 'Container',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: containerHistoricId,
                attributesAdded: [],
              },
              {
                repositoryVersionIndex: 1,
                typeBlueId: containerCurrentId,
                attributesAdded: [],
              },
            ],
          },
        },
        contents: {
          [ruleCurrentId]: NodeToMapListOrValue.get(ruleCurrent),
          [containerCurrentId]: NodeToMapListOrValue.get(container),
        },
        schemas: {},
      },
    },
  };

  const document = {
    type: { blueId: containerCurrentId },
    listOfDicts: {
      itemType: {
        type: { blueId: DICTIONARY_TYPE_BLUE_ID },
        keyType: { blueId: textId },
        valueType: { blueId: ruleCurrentId },
      },
      items: [
        {
          type: { blueId: DICTIONARY_TYPE_BLUE_ID },
          keyType: { blueId: textId },
          valueType: { blueId: ruleCurrentId },
          first: {
            type: { blueId: ruleCurrentId },
            field: { nested: { value: 'keep' }, nested2: { value: 'drop' } },
            metadata: { notes: { value: 'note' }, flags: { value: 'flag' } },
          },
        },
      ],
    },
  };

  return {
    repository,
    ids: { textId, ruleHistoric: ruleHistoricId, ruleCurrent: ruleCurrentId },
    document,
  };
}

function buildRepositoryFixtures() {
  const repositoryVersions = ['R0', 'R1', 'R2', 'R3'] as const;

  const textId = TEXT_TYPE_BLUE_ID;

  const metadataDefinition = (withFlags: boolean) => {
    const metadata = new BlueNode().setProperties({
      notes: new BlueNode().setType(new BlueNode().setBlueId(textId)),
    });
    if (withFlags) {
      metadata.addProperty(
        'flags',
        new BlueNode().setType(new BlueNode().setBlueId(textId)),
      );
    }
    return metadata;
  };

  const ruleDefinition = (
    withSeverity: boolean,
    withMetadataFlags: boolean,
  ) => {
    const rule = new BlueNode('Rule').setProperties({
      when: new BlueNode().setType(new BlueNode().setBlueId(textId)),
      then: new BlueNode().setType(new BlueNode().setBlueId(textId)),
      metadata: metadataDefinition(withMetadataFlags),
    });
    if (withSeverity) {
      rule.addProperty(
        'severity',
        new BlueNode().setType(new BlueNode().setBlueId(textId)),
      );
    }
    return rule;
  };

  const ruleHistoricNode = ruleDefinition(false, false);
  const ruleHistoricId = BlueIdCalculator.calculateBlueIdSync(ruleHistoricNode);
  const ruleCurrentNode = ruleDefinition(true, true);
  const ruleCurrentId = BlueIdCalculator.calculateBlueIdSync(ruleCurrentNode);

  const auditInfoNode = new BlueNode('AuditInfo').setProperties({
    notes: new BlueNode().setType(new BlueNode().setBlueId(textId)),
  });
  const auditInfoId = BlueIdCalculator.calculateBlueIdSync(auditInfoNode);

  const policyDefinition = (withAudit: boolean, ruleBlueId: string) => {
    const policy = new BlueNode('Policy').setProperties({
      owner: new BlueNode().setType(new BlueNode().setBlueId(textId)),
      rules: new BlueNode().setItems([
        new BlueNode().setType(new BlueNode().setBlueId(ruleBlueId)),
      ]),
    });
    if (withAudit) {
      policy.addProperty(
        'audit',
        new BlueNode().setType(new BlueNode().setBlueId(auditInfoId)),
      );
    }
    return policy;
  };

  const policyHistoricNode = policyDefinition(false, ruleHistoricId);
  const policyHistoricId =
    BlueIdCalculator.calculateBlueIdSync(policyHistoricNode);
  const policyCurrentNode = policyDefinition(true, ruleCurrentId);
  const policyCurrentId =
    BlueIdCalculator.calculateBlueIdSync(policyCurrentNode);

  const subscriptionUpdateNode = new BlueNode(
    'SubscriptionUpdate',
  ).setProperties({
    subscriptionId: new BlueNode().setType(new BlueNode().setBlueId(textId)),
  });
  const subscriptionUpdateId = BlueIdCalculator.calculateBlueIdSync(
    subscriptionUpdateNode,
  );

  const messageNode = new BlueNode('Message').setProperties({
    text: new BlueNode().setType(new BlueNode().setBlueId(textId)),
  });
  const messageId = BlueIdCalculator.calculateBlueIdSync(messageNode);

  const externalTypeNode = new BlueNode('ExternalType').setProperties({
    payload: new BlueNode().setType(new BlueNode().setBlueId(textId)),
  });
  const externalTypeId = BlueIdCalculator.calculateBlueIdSync(externalTypeNode);

  const coreSchemas = {
    [textId]: withTypeBlueId(textId)(
      z.object({
        name: z.string().optional(),
        description: z.string().optional(),
      }),
    ),
  };

  const ruleSchemaCurrent = withTypeBlueId(ruleCurrentId)(
    z.object({
      when: z.string(),
      then: z.string(),
      severity: z.string().optional(),
      metadata: z
        .object({
          notes: z.string().optional(),
          flags: z.string().optional(),
        })
        .optional(),
    }),
  );

  const myosSchemas = {
    [ruleCurrentId]: ruleSchemaCurrent,
    [policyCurrentId]: withTypeBlueId(policyCurrentId)(z.object({})),
    [auditInfoId]: withTypeBlueId(auditInfoId)(
      z.object({ notes: z.any().optional() }),
    ),
    [subscriptionUpdateId]: withTypeBlueId(subscriptionUpdateId)(z.object({})),
  };

  const conversationSchemas = {
    [messageId]: withTypeBlueId(messageId)(
      z.object({
        text: z.any(),
      }),
    ),
  };

  const otherSchemas = {
    [externalTypeId]: withTypeBlueId(externalTypeId)(
      z.object({
        value: z.any().optional(),
      }),
    ),
  };

  const repository: VersionedBlueRepository = {
    name: 'repo.blue',
    repositoryVersions,
    packages: {
      core: {
        name: 'core',
        aliases: {},
        typesMeta: {},
        contents: {},
        schemas: coreSchemas,
      },
      myos: {
        name: 'myos',
        aliases: {
          'myos/Rule': ruleCurrentId,
          'myos/Policy': policyCurrentId,
          'myos/AuditInfo': auditInfoId,
          'myos/SubscriptionUpdate': subscriptionUpdateId,
        },
        typesMeta: {
          [ruleCurrentId]: {
            status: 'stable',
            name: 'Rule',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: ruleHistoricId,
                attributesAdded: [],
              },
              {
                repositoryVersionIndex: 2,
                typeBlueId: ruleCurrentId,
                attributesAdded: ['/severity', '/metadata/flags'],
              },
            ],
          },
          [policyCurrentId]: {
            status: 'stable',
            name: 'Policy',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: policyHistoricId,
                attributesAdded: [],
              },
              {
                repositoryVersionIndex: 3,
                typeBlueId: policyCurrentId,
                attributesAdded: ['/audit'],
              },
            ],
          },
          [auditInfoId]: {
            status: 'stable',
            name: 'AuditInfo',
            versions: [
              {
                repositoryVersionIndex: 3,
                typeBlueId: auditInfoId,
                attributesAdded: [],
              },
            ],
          },
          [subscriptionUpdateId]: {
            status: 'dev',
            name: 'SubscriptionUpdate',
            versions: [
              {
                repositoryVersionIndex: 3,
                typeBlueId: subscriptionUpdateId,
                attributesAdded: [],
              },
            ],
          },
        },
        contents: {
          [ruleCurrentId]: NodeToMapListOrValue.get(ruleCurrentNode),
          [policyCurrentId]: NodeToMapListOrValue.get(policyCurrentNode),
          [auditInfoId]: NodeToMapListOrValue.get(auditInfoNode),
          [subscriptionUpdateId]: NodeToMapListOrValue.get(
            subscriptionUpdateNode,
          ),
        },
        schemas: myosSchemas,
      },
      conversation: {
        name: 'conversation',
        aliases: {
          'conversation/Message': messageId,
        },
        typesMeta: {
          [messageId]: {
            status: 'stable',
            name: 'Message',
            versions: [
              {
                repositoryVersionIndex: 1,
                typeBlueId: messageId,
                attributesAdded: [],
              },
            ],
          },
        },
        contents: {
          [messageId]: NodeToMapListOrValue.get(messageNode),
        },
        schemas: conversationSchemas,
      },
    },
  };

  const otherRepository: VersionedBlueRepository = {
    name: 'other.repo',
    repositoryVersions: ['X0'],
    packages: {
      other: {
        name: 'other',
        aliases: {
          'other/ExternalType': externalTypeId,
        },
        typesMeta: {
          [externalTypeId]: {
            status: 'stable',
            name: 'ExternalType',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: externalTypeId,
                attributesAdded: [],
              },
            ],
          },
        },
        contents: {
          [externalTypeId]: NodeToMapListOrValue.get(externalTypeNode),
        },
        schemas: otherSchemas,
      },
    },
  };

  const ids = {
    text: textId,
    ruleHistoric: ruleHistoricId,
    ruleCurrent: ruleCurrentId,
    policyHistoric: policyHistoricId,
    policyCurrent: policyCurrentId,
    auditInfo: auditInfoId,
    subscription: subscriptionUpdateId,
    message: messageId,
    externalType: externalTypeId,
  };

  const fixtureSchemas = {
    ruleSchemaCurrent,
  };

  return {
    repository,
    otherRepository,
    ids,
    repositoryVersions,
    fixtureSchemas,
  };
}
