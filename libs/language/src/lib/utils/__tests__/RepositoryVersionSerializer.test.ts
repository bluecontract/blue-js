import { describe, expect, it } from 'vitest';
import { RepositoryVersionSerializer } from '../RepositoryVersionSerializer';
import { RepositoryRegistry } from '../../repository/RepositoryRuntime';
import { BlueNode, NodeDeserializer } from '../../model';
import { NodeToMapListOrValue } from '../NodeToMapListOrValue';
import { BlueError, BlueErrorCode } from '../../errors/BlueError';
import type { BlueRepository } from '../../types/BlueRepository';
import {
  DICTIONARY_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../Properties';
import {
  buildInlineRepository,
  buildInheritanceRepository,
  buildTypedRepository,
  ids,
  otherRepository,
  repoBlue,
  textValue,
} from '../../__tests__/repositoryVersioning/fixtures';

function createSerializer(options: {
  repositories: BlueRepository[];
  targetRepoVersionIndexes: Record<string, number>;
  fallbackToCurrentInlineDefinitions?: boolean;
}) {
  return new RepositoryVersionSerializer({
    registry: new RepositoryRegistry(options.repositories),
    targetRepoVersionIndexes: options.targetRepoVersionIndexes,
    fallbackToCurrentInlineDefinitions:
      options.fallbackToCurrentInlineDefinitions ?? false,
  });
}

function captureError(fn: () => void): BlueError {
  try {
    fn();
  } catch (err) {
    return err as BlueError;
  }
  throw new Error('Expected error but none was thrown');
}

function buildDropRepository() {
  const repositoryVersions = ['R0', 'R1'] as const;
  const baseField = () =>
    new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

  const itemBase = new BlueNode('Item').setProperties({
    keep: baseField(),
  });
  const itemCurrent = itemBase.clone().addProperty('extra', baseField());

  const itemOldId = 'drop/Item@0';
  const itemCurrentId = 'drop/Item@1';

  const repository: BlueRepository = {
    name: 'repo.drop',
    repositoryVersions,
    packages: {
      core: {
        name: 'core',
        aliases: { 'core/Item': itemCurrentId },
        typesMeta: {
          [itemCurrentId]: {
            status: 'stable',
            name: 'Item',
            versions: [
              {
                repositoryVersionIndex: 0,
                typeBlueId: itemOldId,
                attributesAdded: [],
              },
              {
                repositoryVersionIndex: 1,
                typeBlueId: itemCurrentId,
                attributesAdded: ['/extra'],
              },
            ],
          },
        },
        contents: {
          [itemCurrentId]: NodeToMapListOrValue.get(itemCurrent),
        },
        schemas: {},
      },
    },
  };

  return {
    repository,
    ids: { itemOldId, itemCurrentId },
  };
}

describe('RepositoryVersionSerializer', () => {
  it('keeps core type BlueIds unchanged', () => {
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID),
    );
    const transformed = serializer.transform(node);

    expect(transformed.getType()?.getBlueId()).toEqual(TEXT_TYPE_BLUE_ID);
  });

  it('maps stable types to the target version and drops new fields', () => {
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.ruleCurrent),
    );
    node.setProperties({
      when: textValue('on'),
      then: textValue('off'),
      severity: textValue('high'),
      metadata: new BlueNode().setProperties({
        notes: textValue('note'),
        flags: textValue('flag'),
      }),
    });

    const transformed = serializer.transform(node);

    expect(transformed.getType()?.getBlueId()).toEqual(ids.ruleHistoric);
    const props = transformed.getProperties();
    expect(props?.severity).toBeUndefined();
    const metadata = props?.metadata;
    expect(metadata?.getProperties()?.flags).toBeUndefined();
    expect(metadata?.getProperties()?.notes).toBeDefined();
  });

  it('maps historical input to the latest BlueId when targeting current version', () => {
    const targetIndex = repoBlue.repositoryVersions.length - 1;
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: { 'repo.blue': targetIndex },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.ruleHistoric),
    );
    node.setProperties({
      when: textValue('on'),
      then: textValue('off'),
    });

    const transformed = serializer.transform(node);

    expect(transformed.getType()?.getBlueId()).toEqual(ids.ruleCurrent);
    expect(transformed.getProperties()?.when).toBeDefined();
    expect(transformed.getProperties()?.then).toBeDefined();
  });

  it('normalizes out-of-order versions before serialization', () => {
    const reorderedRepository = JSON.parse(
      JSON.stringify(repoBlue),
    ) as typeof repoBlue;
    const ruleVersions =
      reorderedRepository.packages.myos.typesMeta[ids.ruleCurrent].versions;
    reorderedRepository.packages.myos.typesMeta[ids.ruleCurrent].versions = [
      ...ruleVersions,
    ].reverse();

    const serializer = createSerializer({
      repositories: [reorderedRepository],
      targetRepoVersionIndexes: { 'repo.blue': 1 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.ruleCurrent),
    );
    node.setProperties({
      when: textValue('w'),
      then: textValue('t'),
      severity: textValue('high'),
    });

    const transformed = serializer.transform(node);

    expect(transformed.getType()?.getBlueId()).toEqual(ids.ruleHistoric);
    expect(transformed.getProperties()?.severity).toBeUndefined();
  });

  it('drops list item fields based on itemType versioning', () => {
    const { repository, ids: dropIds } = buildDropRepository();
    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.drop': 0 },
    });

    const listNode = new BlueNode()
      .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
      .setItemType(new BlueNode().setBlueId(dropIds.itemCurrentId))
      .setItems([
        new BlueNode().setProperties({
          keep: textValue('ok'),
          extra: textValue('drop-me'),
        }),
      ]);

    const transformed = serializer.transform(listNode);
    const item = transformed.getItems()?.[0];

    expect(transformed.getItemType()?.getBlueId()).toEqual(dropIds.itemOldId);
    expect(item?.getProperties()?.extra).toBeUndefined();
    expect(item?.getProperties()?.keep).toBeDefined();
  });

  it('drops fields inside inline list itemType definitions', () => {
    const repository = buildInlineRepository({
      pointer: '/listProp/itemType/prop2',
      buildContainer: (itemType) =>
        new BlueNode('InlineList').setProperties({
          listProp: new BlueNode()
            .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
            .setItemType(itemType)
            .setItems([
              new BlueNode().setProperties({
                prop1: textValue('v1'),
                prop2: textValue('v2'),
              }),
            ]),
        }),
    });
    const containerBlueId = Object.values(repository.packages.core.aliases)[0];
    if (!containerBlueId) {
      throw new Error('Expected inline list container blueId');
    }

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(containerBlueId),
    );
    node.setProperties({
      listProp: new BlueNode()
        .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
        .setItemType(
          new BlueNode().setProperties({
            prop1: textValue('v1'),
            prop2: textValue('v2'),
          }),
        )
        .setItems([
          new BlueNode().setProperties({
            prop1: textValue('v1'),
            prop2: textValue('v2'),
          }),
        ]),
    });

    const transformed = serializer.transform(node);
    const listProp = transformed.getProperties()?.listProp;
    const itemType = listProp?.getItemType();
    const items = listProp?.getItems();

    expect(itemType?.getProperties()?.prop2).toBeUndefined();
    expect(items?.[0]?.getProperties()?.prop2).toBeUndefined();
    expect(items?.[0]?.getProperties()?.prop1).toBeDefined();
  });

  it('drops dictionary value fields based on valueType versioning', () => {
    const { repository, ids: dropIds } = buildDropRepository();
    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.drop': 0 },
    });

    const dictNode = new BlueNode()
      .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
      .setKeyType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
      .setValueType(new BlueNode().setBlueId(dropIds.itemCurrentId))
      .setProperties({
        entry: new BlueNode().setProperties({
          keep: textValue('ok'),
          extra: textValue('drop-me'),
        }),
        schema: new BlueNode().setProperties({
          extra: textValue('keep-me'),
        }),
      });

    const transformed = serializer.transform(dictNode);
    const props = transformed.getProperties();
    const entry = props?.entry;

    expect(transformed.getValueType()?.getBlueId()).toEqual(dropIds.itemOldId);
    expect(entry?.getProperties()?.extra).toBeUndefined();
    expect(entry?.getProperties()?.keep).toBeDefined();
  });

  it('drops nested fields for typed list of dictionaries', () => {
    const fixture = buildTypedRepository();
    const serializer = createSerializer({
      repositories: [fixture.repository],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
    });

    const node = NodeDeserializer.deserialize(fixture.document);
    const transformed = serializer.transform(node);

    const listOfDicts = transformed.getProperties()?.listOfDicts;
    const listItem = listOfDicts?.getItems()?.[0];
    const first = listItem?.getProperties()?.first;
    const metadata = first?.getProperties()?.metadata;
    const field = first?.getProperties()?.field;

    expect(metadata?.getProperties()?.flags).toBeUndefined();
    expect(field?.getProperties()?.nested2).toBeUndefined();
    expect(metadata?.getProperties()?.notes?.getValue()).toEqual('note');
    expect(field?.getProperties()?.nested?.getValue()).toEqual('keep');

    expect(listOfDicts?.getItemType()?.getValueType()?.getBlueId()).toEqual(
      fixture.ids.ruleHistoric,
    );
    expect(first?.getType()?.getBlueId()).toEqual(fixture.ids.ruleHistoric);
  });

  it('drops fields inside inline dictionary valueType definitions', () => {
    const repository = buildInlineRepository({
      pointer: '/dictProp/valueType/prop2',
      buildContainer: (valueType) =>
        new BlueNode('InlineDict').setProperties({
          dictProp: new BlueNode()
            .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
            .setKeyType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
            .setValueType(valueType)
            .setProperties({
              first: new BlueNode().setProperties({
                prop1: textValue('v1'),
                prop2: textValue('v2'),
              }),
            }),
        }),
    });
    const containerBlueId = Object.values(repository.packages.core.aliases)[0];
    if (!containerBlueId) {
      throw new Error('Expected inline dictionary container blueId');
    }

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(containerBlueId),
    );
    node.setProperties({
      dictProp: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
        .setValueType(
          new BlueNode().setProperties({
            prop1: textValue('v1'),
            prop2: textValue('v2'),
          }),
        )
        .setProperties({
          first: new BlueNode().setProperties({
            prop1: textValue('v1'),
            prop2: textValue('v2'),
          }),
        }),
    });

    const transformed = serializer.transform(node);
    const dictProp = transformed.getProperties()?.dictProp;

    expect(dictProp?.getValueType()?.getProperties()?.prop2).toBeUndefined();
    expect(
      dictProp?.getProperties()?.first?.getProperties()?.prop2,
    ).toBeUndefined();
    expect(
      dictProp?.getProperties()?.first?.getProperties()?.prop1,
    ).toBeDefined();
  });

  it('drops inherited fields when a base type changes', () => {
    const fixture = buildInheritanceRepository({ includeChildV0: true });
    const serializer = createSerializer({
      repositories: [fixture.repository],
      targetRepoVersionIndexes: { 'repo.inherit': 0 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(fixture.ids.childV1),
    );
    node.setProperties({
      keep: textValue('keep'),
      extra: textValue('drop'),
      own: textValue('own'),
    });

    const transformed = serializer.transform(node);

    expect(transformed.getType()?.getBlueId()).toEqual(fixture.ids.childV0);
    expect(transformed.getProperties()?.extra).toBeUndefined();
    expect(transformed.getProperties()?.keep?.getValue()).toEqual('keep');
    expect(transformed.getProperties()?.own?.getValue()).toEqual('own');
  });

  it('inlines new types and maps inherited base types to the target version', () => {
    const fixture = buildInheritanceRepository({ includeChildV0: false });
    const serializer = createSerializer({
      repositories: [fixture.repository],
      targetRepoVersionIndexes: { 'repo.inherit': 0 },
      fallbackToCurrentInlineDefinitions: true,
    });

    const node = new BlueNode()
      .setType(new BlueNode().setBlueId(fixture.ids.childV1))
      .setProperties({
        keep: textValue('keep'),
        extra: textValue('extra'),
        own: textValue('own'),
      });
    const transformed = serializer.transform(node);

    const inlineType = transformed.getType();
    expect(inlineType?.getBlueId()).toBeUndefined();
    expect(inlineType?.getName()).toEqual('Child');
    expect(inlineType?.getType()?.getBlueId()).toEqual(fixture.ids.baseV0);
    expect(inlineType?.getProperties()?.own).toBeDefined();
    expect(inlineType?.getProperties()?.own?.getType()?.getBlueId()).toEqual(
      TEXT_TYPE_BLUE_ID,
    );
    expect(inlineType?.getProperties()?.extra).toBeUndefined();
    expect(transformed.getProperties()?.keep?.getValue()).toEqual('keep');
    expect(transformed.getProperties()?.extra?.getValue()).toEqual('extra');
    expect(transformed.getProperties()?.own?.getValue()).toEqual('own');
  });

  it('applies drops to schema entries inside dictionaries', () => {
    const repository: BlueRepository = {
      name: 'repo.dict',
      repositoryVersions: ['R0', 'R1'],
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Container': 'container@v1' },
          typesMeta: {
            'container@v1': {
              status: 'stable',
              name: 'Container',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: 'container@v0',
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: 'container@v1',
                  attributesAdded: ['/map/valueType/minFields'],
                },
              ],
            },
          },
          contents: { 'container@v1': {} },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.dict': 0 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId('container@v1'),
    );
    node.setProperties({
      map: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
        .setValueType(
          new BlueNode().setProperties({
            minFields: textValue('drop'),
            keep: textValue('keep'),
          }),
        )
        .setProperties({
          schema: new BlueNode().setProperties({
            minFields: textValue('keep-schema'),
          }),
          first: new BlueNode().setProperties({
            minFields: textValue('drop-entry'),
            keep: textValue('keep-entry'),
          }),
        }),
    });

    const transformed = serializer.transform(node);
    const map = transformed.getProperties()?.map;

    expect(map?.getValueType()?.getProperties()?.minFields).toBeUndefined();
    expect(map?.getValueType()?.getProperties()?.keep).toBeDefined();
    expect(
      map?.getProperties()?.first?.getProperties()?.minFields,
    ).toBeUndefined();
    expect(map?.getProperties()?.first?.getProperties()?.keep).toBeDefined();
    expect(
      map?.getProperties()?.schema?.getProperties()?.minFields,
    ).toBeUndefined();
  });

  it('drops fields using escaped pointer segments', () => {
    const repository: BlueRepository = {
      name: 'repo.escape',
      repositoryVersions: ['R0', 'R1'],
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Escaped': 'escaped@v1' },
          typesMeta: {
            'escaped@v1': {
              status: 'stable',
              name: 'Escaped',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: 'escaped@v0',
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: 'escaped@v1',
                  attributesAdded: ['/field/a~1b', '/field/tilda~0x'],
                },
              ],
            },
          },
          contents: { 'escaped@v1': {} },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.escape': 0 },
    });

    const node = new BlueNode().setType(new BlueNode().setBlueId('escaped@v1'));
    node.setProperties({
      field: new BlueNode().setProperties({
        'a/b': textValue('drop'),
        'tilda~x': textValue('drop2'),
        keep: textValue('keep'),
      }),
    });

    const transformed = serializer.transform(node);
    const fieldProps = transformed.getProperties()?.field?.getProperties();

    expect(fieldProps?.['a/b']).toBeUndefined();
    expect(fieldProps?.['tilda~x']).toBeUndefined();
    expect(fieldProps?.keep?.getValue()).toEqual('keep');
  });

  it('throws when the target repository version is missing', () => {
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: {},
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.ruleCurrent),
    );
    const error = captureError(() => serializer.transform(node));

    expect(error.code).toEqual(
      BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
    );
    expect(error.message).toContain(
      "Repository 'repo.blue' not provided in BlueContext.",
    );
  });

  it('inlines definitions when fallback is enabled', () => {
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: {},
      fallbackToCurrentInlineDefinitions: true,
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.ruleCurrent),
    );
    const transformed = serializer.transform(node);
    const typeNode = transformed.getType();

    expect(typeNode?.getBlueId()).toBeUndefined();
    expect(typeNode?.getName()).toEqual('Rule');
    expect(typeNode?.getProperties()?.when).toBeDefined();
  });

  it('inlines external types when fallback is enabled', () => {
    const serializer = createSerializer({
      repositories: [repoBlue, otherRepository],
      targetRepoVersionIndexes: { 'repo.blue': 2 },
      fallbackToCurrentInlineDefinitions: true,
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.externalType),
    );
    node.setProperties({
      payload: textValue('value'),
    });

    const transformed = serializer.transform(node);
    const typeNode = transformed.getType();

    expect(typeNode?.getBlueId()).toBeUndefined();
    expect(typeNode?.getName()).toEqual('ExternalType');
  });

  it('throws when inline fallback encounters a cycle', () => {
    const typeAId = 'cycle/TypeA';
    const typeBId = 'cycle/TypeB';

    const typeADefinition = new BlueNode('TypeA').setType(
      new BlueNode().setBlueId(typeBId),
    );
    const typeBDefinition = new BlueNode('TypeB').setType(
      new BlueNode().setBlueId(typeAId),
    );

    const repository: BlueRepository = {
      name: 'repo.cycle',
      repositoryVersions: ['R0'],
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/TypeA': typeAId, 'core/TypeB': typeBId },
          typesMeta: {
            [typeAId]: {
              status: 'stable',
              name: 'TypeA',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: typeAId,
                  attributesAdded: [],
                },
              ],
            },
            [typeBId]: {
              status: 'stable',
              name: 'TypeB',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: typeBId,
                  attributesAdded: [],
                },
              ],
            },
          },
          contents: {
            [typeAId]: NodeToMapListOrValue.get(typeADefinition),
            [typeBId]: NodeToMapListOrValue.get(typeBDefinition),
          },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: {},
      fallbackToCurrentInlineDefinitions: true,
    });

    const node = new BlueNode().setType(new BlueNode().setBlueId(typeAId));
    const error = captureError(() => serializer.transform(node));

    expect(error.code).toEqual(
      BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
    );
    expect(error.details[0]?.context?.cycle).toEqual([
      typeAId,
      typeBId,
      typeAId,
    ]);
  });

  it('throws when inlining encounters a property-based cycle', () => {
    const typeAId = 'cycle/PropA';
    const typeBId = 'cycle/PropB';

    const typeADefinition = new BlueNode('PropA').setProperties({
      b: new BlueNode().setType(new BlueNode().setBlueId(typeBId)),
    });
    const typeBDefinition = new BlueNode('PropB').setProperties({
      a: new BlueNode().setType(new BlueNode().setBlueId(typeAId)),
    });

    const repository: BlueRepository = {
      name: 'repo.cycle.props',
      repositoryVersions: ['R0'],
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/PropA': typeAId, 'core/PropB': typeBId },
          typesMeta: {
            [typeAId]: {
              status: 'stable',
              name: 'PropA',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: typeAId,
                  attributesAdded: [],
                },
              ],
            },
            [typeBId]: {
              status: 'stable',
              name: 'PropB',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: typeBId,
                  attributesAdded: [],
                },
              ],
            },
          },
          contents: {
            [typeAId]: NodeToMapListOrValue.get(typeADefinition),
            [typeBId]: NodeToMapListOrValue.get(typeBDefinition),
          },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: {},
      fallbackToCurrentInlineDefinitions: true,
    });

    const node = new BlueNode().setType(new BlueNode().setBlueId(typeAId));
    const error = captureError(() => serializer.transform(node));

    expect(error.code).toEqual(
      BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
    );
    expect(error.details[0]?.context?.cycle).toEqual([
      typeAId,
      typeBId,
      typeAId,
    ]);
  });

  it('rejects dev types when targeting non-current versions', () => {
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.subscription),
    );
    const error = captureError(() => serializer.transform(node));

    expect(error.code).toEqual(
      BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
    );
    expect(error.message).toContain('Dev type cannot be represented');
  });

  it('inlines dev types when fallback is enabled for older versions', () => {
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
      fallbackToCurrentInlineDefinitions: true,
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.subscription),
    );
    node.setProperties({
      subscriptionId: textValue('sub'),
    });

    const transformed = serializer.transform(node);
    const typeNode = transformed.getType();

    expect(typeNode?.getBlueId()).toBeUndefined();
    expect(typeNode?.getName()).toEqual('SubscriptionUpdate');
  });

  it('rejects types introduced after the target version', () => {
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
    });

    const node = new BlueNode().setType(new BlueNode().setBlueId(ids.message));
    const error = captureError(() => serializer.transform(node));

    expect(error.code).toEqual(
      BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
    );
    expect(error.message).toContain(
      `Type introduced after target repository version index 0.`,
    );
  });

  it('rejects unknown type BlueIds without a runtime', () => {
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId('unknown/Type'),
    );
    const error = captureError(() => serializer.transform(node));

    expect(error.code).toEqual(
      BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
    );
    expect(error.message).toContain(
      'Type does not belong to any declared repository.',
    );
  });
});
