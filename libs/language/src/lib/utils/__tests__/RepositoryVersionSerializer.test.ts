import { describe, expect, it } from 'vitest';
import { RepositoryVersionSerializer } from '../RepositoryVersionSerializer';
import { RepositoryRegistry } from '../../repository/RepositoryRuntime';
import { BlueNode, NodeDeserializer } from '../../model';
import { NodeToMapListOrValue } from '../NodeToMapListOrValue';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
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

  it('maps stable types to the target version and preserves data fields', () => {
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
    expect(props?.severity).toBeDefined();
    const metadata = props?.metadata;
    expect(metadata?.getProperties()?.flags).toBeDefined();
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
    expect(transformed.getProperties()?.severity).toBeDefined();
  });

  it('maps list item types without dropping data fields', () => {
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
    expect(item?.getProperties()?.extra).toBeDefined();
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
    expect(items?.[0]?.getProperties()?.prop2).toBeDefined();
    expect(items?.[0]?.getProperties()?.prop1).toBeDefined();
  });

  it('maps inline list itemType blueIds when schemas include them', () => {
    const repositoryVersions = ['R0', 'R1'] as const;
    const baseField = () =>
      new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

    const itemV0 = new BlueNode('ListItem').setProperties({
      prop1: baseField(),
    });
    const itemV1 = itemV0.clone().addProperty('prop2', baseField());
    const itemV0Id = BlueIdCalculator.calculateBlueIdSync(itemV0);
    const itemV1Id = BlueIdCalculator.calculateBlueIdSync(itemV1);

    const containerV0 = new BlueNode('InlineList').setProperties({
      listProp: new BlueNode()
        .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
        .setItemType(itemV0.clone().setBlueId(itemV0Id)),
    });
    const containerV1 = new BlueNode('InlineList').setProperties({
      listProp: new BlueNode()
        .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
        .setItemType(itemV1.clone().setBlueId(itemV1Id)),
    });
    const containerV0Id = BlueIdCalculator.calculateBlueIdSync(containerV0);
    const containerV1Id = BlueIdCalculator.calculateBlueIdSync(containerV1);

    const repository: BlueRepository = {
      name: 'repo.inline.item',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: {
            'core/InlineList': containerV1Id,
            'core/ListItem': itemV1Id,
          },
          typesMeta: {
            [containerV1Id]: {
              status: 'stable',
              name: 'InlineList',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: containerV0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: containerV1Id,
                  attributesAdded: ['/listProp/itemType/prop2'],
                },
              ],
            },
            [itemV1Id]: {
              status: 'stable',
              name: 'ListItem',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: itemV0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: itemV1Id,
                  attributesAdded: ['/prop2'],
                },
              ],
            },
          },
          contents: {
            [containerV1Id]: NodeToMapListOrValue.get(containerV1),
            [itemV1Id]: NodeToMapListOrValue.get(itemV1),
          },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.inline.item': 0 },
    });

    const rootType = containerV1.clone().setBlueId(containerV1Id);
    const node = new BlueNode().setType(rootType);
    node.setProperties({
      listProp: new BlueNode()
        .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
        .setItemType(itemV1.clone().setBlueId(itemV1Id))
        .setItems([
          new BlueNode().setProperties({
            prop1: textValue('v1'),
            prop2: textValue('v2'),
          }),
        ]),
    });

    const transformed = serializer.transform(node);
    const schemaItemType = transformed
      .getType()
      ?.getProperties()
      ?.listProp?.getItemType();
    const listProp = transformed.getProperties()?.listProp;
    const itemType = listProp?.getItemType();
    const items = listProp?.getItems();

    expect(transformed.getType()?.getBlueId()).toEqual(containerV0Id);
    expect(schemaItemType?.getBlueId()).toEqual(itemV0Id);
    expect(itemType?.getBlueId()).toEqual(itemV0Id);
    expect(schemaItemType?.getProperties()?.prop2).toBeUndefined();
    expect(itemType?.getProperties()?.prop2).toBeUndefined();
    expect(items?.[0]?.getProperties()?.prop2).toBeDefined();
  });

  it('maps dictionary value types without dropping data fields', () => {
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
    expect(entry?.getProperties()?.extra).toBeDefined();
    expect(entry?.getProperties()?.keep).toBeDefined();
  });

  it('maps nested types without dropping data fields', () => {
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

    expect(metadata?.getProperties()?.flags).toBeDefined();
    expect(field?.getProperties()?.nested2).toBeDefined();
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
    ).toBeDefined();
    expect(
      dictProp?.getProperties()?.first?.getProperties()?.prop1,
    ).toBeDefined();
  });

  it('maps inline dictionary valueType blueIds when schemas include them', () => {
    const repositoryVersions = ['R0', 'R1'] as const;
    const baseField = () =>
      new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

    const valueV0 = new BlueNode('DictValue').setProperties({
      prop1: baseField(),
    });
    const valueV1 = valueV0.clone().addProperty('prop2', baseField());
    const valueV0Id = BlueIdCalculator.calculateBlueIdSync(valueV0);
    const valueV1Id = BlueIdCalculator.calculateBlueIdSync(valueV1);

    const containerV0 = new BlueNode('InlineDict').setProperties({
      dictProp: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
        .setValueType(valueV0.clone().setBlueId(valueV0Id)),
    });
    const containerV1 = new BlueNode('InlineDict').setProperties({
      dictProp: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
        .setValueType(valueV1.clone().setBlueId(valueV1Id)),
    });
    const containerV0Id = BlueIdCalculator.calculateBlueIdSync(containerV0);
    const containerV1Id = BlueIdCalculator.calculateBlueIdSync(containerV1);

    const repository: BlueRepository = {
      name: 'repo.inline.value',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: {
            'core/InlineDict': containerV1Id,
            'core/DictValue': valueV1Id,
          },
          typesMeta: {
            [containerV1Id]: {
              status: 'stable',
              name: 'InlineDict',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: containerV0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: containerV1Id,
                  attributesAdded: ['/dictProp/valueType/prop2'],
                },
              ],
            },
            [valueV1Id]: {
              status: 'stable',
              name: 'DictValue',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: valueV0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: valueV1Id,
                  attributesAdded: ['/prop2'],
                },
              ],
            },
          },
          contents: {
            [containerV1Id]: NodeToMapListOrValue.get(containerV1),
            [valueV1Id]: NodeToMapListOrValue.get(valueV1),
          },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.inline.value': 0 },
    });

    const rootType = containerV1.clone().setBlueId(containerV1Id);
    const node = new BlueNode().setType(rootType);
    node.setProperties({
      dictProp: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
        .setValueType(valueV1.clone().setBlueId(valueV1Id))
        .setProperties({
          first: new BlueNode().setProperties({
            prop1: textValue('v1'),
            prop2: textValue('v2'),
          }),
        }),
    });

    const transformed = serializer.transform(node);
    const schemaValueType = transformed
      .getType()
      ?.getProperties()
      ?.dictProp?.getValueType();
    const dictProp = transformed.getProperties()?.dictProp;
    const valueType = dictProp?.getValueType();

    expect(transformed.getType()?.getBlueId()).toEqual(containerV0Id);
    expect(schemaValueType?.getBlueId()).toEqual(valueV0Id);
    expect(valueType?.getBlueId()).toEqual(valueV0Id);
    expect(schemaValueType?.getProperties()?.prop2).toBeUndefined();
    expect(valueType?.getProperties()?.prop2).toBeUndefined();
    expect(
      dictProp?.getProperties()?.first?.getProperties()?.prop2,
    ).toBeDefined();
  });

  it('drops fields inside inline type definitions using /type pointers', () => {
    const repositoryVersions = ['R0', 'R1'] as const;
    const baseField = () =>
      new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

    const inlineBase = new BlueNode().setProperties({ prop1: baseField() });
    const inlineCurrent = inlineBase.clone().addProperty('prop2', baseField());

    const containerV0 = new BlueNode('Container').setProperties({
      field: new BlueNode().setType(inlineBase),
      fieldNoType: new BlueNode().setType(inlineBase),
    });
    const containerV1 = new BlueNode('Container').setProperties({
      field: new BlueNode().setType(inlineCurrent),
      fieldNoType: new BlueNode().setType(inlineCurrent),
    });

    const containerV0Id = BlueIdCalculator.calculateBlueIdSync(containerV0);
    const containerV1Id = BlueIdCalculator.calculateBlueIdSync(containerV1);

    const repository: BlueRepository = {
      name: 'repo.type',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Container': containerV1Id },
          typesMeta: {
            [containerV1Id]: {
              status: 'stable',
              name: 'Container',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: containerV0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: containerV1Id,
                  attributesAdded: [
                    '/field/type/prop2',
                    '/fieldNoType/type/prop2',
                  ],
                },
              ],
            },
          },
          contents: {
            [containerV1Id]: NodeToMapListOrValue.get(containerV1),
          },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.type': 0 },
    });

    const rootType = containerV1.clone().setBlueId(containerV1Id);
    const node = new BlueNode().setType(rootType);
    node.setProperties({
      field: new BlueNode()
        .setType(
          new BlueNode().setProperties({
            prop1: baseField(),
            prop2: baseField(),
          }),
        )
        .setProperties({
          prop1: textValue('v1'),
          prop2: textValue('v2'),
        }),
      fieldNoType: new BlueNode().setProperties({
        prop1: textValue('v1'),
        prop2: textValue('v2'),
      }),
    });

    const transformed = serializer.transform(node);
    const field = transformed.getProperties()?.field;
    const fieldNoType = transformed.getProperties()?.fieldNoType;

    expect(transformed.getType()?.getBlueId()).toEqual(containerV0Id);
    expect(field?.getType()?.getProperties()?.prop2).toBeUndefined();
    expect(field?.getProperties()?.prop2).toBeDefined();
    expect(fieldNoType?.getType()).toBeUndefined();
    expect(fieldNoType?.getProperties()?.prop2).toBeDefined();
  });

  it('drops root fields inside inline type definitions', () => {
    const repositoryVersions = ['R0', 'R1'] as const;
    const baseField = () =>
      new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

    const test1V0 = new BlueNode('Test1').setProperties({
      field1: baseField(),
    });
    const test1V1 = test1V0.clone().addProperty('field2', baseField());
    const test1V0Id = BlueIdCalculator.calculateBlueIdSync(test1V0);
    const test1V1Id = BlueIdCalculator.calculateBlueIdSync(test1V1);

    const inlineTest1Schema = test1V1.clone().setBlueId(test1V1Id);
    const containerType = new BlueNode('Container').setProperties({
      fieldA: new BlueNode().setType(inlineTest1Schema),
    });
    const containerId = BlueIdCalculator.calculateBlueIdSync(containerType);

    const repository: BlueRepository = {
      name: 'repo.root',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: {
            'core/Container': containerId,
            'core/Test1': test1V1Id,
          },
          typesMeta: {
            [containerId]: {
              status: 'stable',
              name: 'Container',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: containerId,
                  attributesAdded: [],
                },
              ],
            },
            [test1V1Id]: {
              status: 'stable',
              name: 'Test1',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: test1V0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: test1V1Id,
                  attributesAdded: ['/field2'],
                },
              ],
            },
          },
          contents: {
            [containerId]: NodeToMapListOrValue.get(containerType),
            [test1V1Id]: NodeToMapListOrValue.get(test1V1),
          },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.root': 0 },
    });

    const rootType = containerType.clone().setBlueId(containerId);
    const node = new BlueNode().setType(rootType);
    node.setProperties({
      fieldA: new BlueNode()
        .setType(test1V1.clone().setBlueId(test1V1Id))
        .setProperties({
          field1: textValue('v1'),
          field2: textValue('v2'),
        }),
    });

    const transformed = serializer.transform(node);
    const schemaFieldAType = transformed
      .getType()
      ?.getProperties()
      ?.fieldA?.getType();
    const dataFieldA = transformed.getProperties()?.fieldA;
    const dataFieldAType = dataFieldA?.getType();

    expect(schemaFieldAType?.getBlueId()).toEqual(test1V0Id);
    expect(dataFieldAType?.getBlueId()).toEqual(test1V0Id);
    expect(schemaFieldAType?.getProperties()?.field2).toBeUndefined();
    expect(dataFieldAType?.getProperties()?.field2).toBeUndefined();
    expect(dataFieldA?.getProperties()?.field2).toBeDefined();
  });

  it('drops fields inside inline keyType definitions using /keyType pointers', () => {
    const repositoryVersions = ['R0', 'R1'] as const;
    const baseField = () =>
      new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

    const keyBase = new BlueNode().setProperties({ prop1: baseField() });
    const keyCurrent = keyBase.clone().addProperty('prop2', baseField());

    const containerV0 = new BlueNode('Container').setProperties({
      map: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(keyBase)
        .setValueType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
      mapNoKey: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(keyBase)
        .setValueType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
    });
    const containerV1 = new BlueNode('Container').setProperties({
      map: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(keyCurrent)
        .setValueType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
      mapNoKey: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(keyCurrent)
        .setValueType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
    });

    const containerV0Id = BlueIdCalculator.calculateBlueIdSync(containerV0);
    const containerV1Id = BlueIdCalculator.calculateBlueIdSync(containerV1);

    const repository: BlueRepository = {
      name: 'repo.key',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Container': containerV1Id },
          typesMeta: {
            [containerV1Id]: {
              status: 'stable',
              name: 'Container',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: containerV0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: containerV1Id,
                  attributesAdded: [
                    '/map/keyType/prop2',
                    '/mapNoKey/keyType/prop2',
                  ],
                },
              ],
            },
          },
          contents: {
            [containerV1Id]: NodeToMapListOrValue.get(containerV1),
          },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.key': 0 },
    });

    const rootType = containerV1.clone().setBlueId(containerV1Id);
    const node = new BlueNode().setType(rootType);
    node.setProperties({
      map: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(
          new BlueNode().setProperties({
            prop1: baseField(),
            prop2: baseField(),
          }),
        )
        .setValueType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
        .setProperties({
          first: textValue('v1'),
        }),
      mapNoKey: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setValueType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
        .setProperties({
          second: textValue('v2'),
        }),
    });

    const transformed = serializer.transform(node);
    const map = transformed.getProperties()?.map;
    const mapNoKey = transformed.getProperties()?.mapNoKey;

    expect(transformed.getType()?.getBlueId()).toEqual(containerV0Id);
    expect(map?.getKeyType()?.getProperties()?.prop2).toBeUndefined();
    expect(map?.getProperties()?.first?.getValue()).toEqual('v1');
    expect(mapNoKey?.getKeyType()).toBeUndefined();
    expect(mapNoKey?.getProperties()?.second?.getValue()).toEqual('v2');
  });

  it('maps inline dictionary keyType blueIds when schemas include them', () => {
    const repositoryVersions = ['R0', 'R1'] as const;
    const baseField = () =>
      new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

    const keyV0 = new BlueNode('DictKey').setProperties({
      prop1: baseField(),
    });
    const keyV1 = keyV0.clone().addProperty('prop2', baseField());
    const keyV0Id = BlueIdCalculator.calculateBlueIdSync(keyV0);
    const keyV1Id = BlueIdCalculator.calculateBlueIdSync(keyV1);

    const containerV0 = new BlueNode('InlineKeyDict').setProperties({
      map: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(keyV0.clone().setBlueId(keyV0Id))
        .setValueType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
    });
    const containerV1 = new BlueNode('InlineKeyDict').setProperties({
      map: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(keyV1.clone().setBlueId(keyV1Id))
        .setValueType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
    });
    const containerV0Id = BlueIdCalculator.calculateBlueIdSync(containerV0);
    const containerV1Id = BlueIdCalculator.calculateBlueIdSync(containerV1);

    const repository: BlueRepository = {
      name: 'repo.inline.key',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: {
            'core/InlineKeyDict': containerV1Id,
            'core/DictKey': keyV1Id,
          },
          typesMeta: {
            [containerV1Id]: {
              status: 'stable',
              name: 'InlineKeyDict',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: containerV0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: containerV1Id,
                  attributesAdded: ['/map/keyType/prop2'],
                },
              ],
            },
            [keyV1Id]: {
              status: 'stable',
              name: 'DictKey',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: keyV0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: keyV1Id,
                  attributesAdded: ['/prop2'],
                },
              ],
            },
          },
          contents: {
            [containerV1Id]: NodeToMapListOrValue.get(containerV1),
            [keyV1Id]: NodeToMapListOrValue.get(keyV1),
          },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.inline.key': 0 },
    });

    const rootType = containerV1.clone().setBlueId(containerV1Id);
    const node = new BlueNode().setType(rootType);
    node.setProperties({
      map: new BlueNode()
        .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
        .setKeyType(keyV1.clone().setBlueId(keyV1Id))
        .setValueType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
        .setProperties({
          first: textValue('v1'),
        }),
    });

    const transformed = serializer.transform(node);
    const schemaKeyType = transformed
      .getType()
      ?.getProperties()
      ?.map?.getKeyType();
    const map = transformed.getProperties()?.map;
    const keyType = map?.getKeyType();

    expect(transformed.getType()?.getBlueId()).toEqual(containerV0Id);
    expect(schemaKeyType?.getBlueId()).toEqual(keyV0Id);
    expect(keyType?.getBlueId()).toEqual(keyV0Id);
    expect(schemaKeyType?.getProperties()?.prop2).toBeUndefined();
    expect(keyType?.getProperties()?.prop2).toBeUndefined();
    expect(map?.getProperties()?.first?.getValue()).toEqual('v1');
  });

  it('maps inherited types without dropping data fields', () => {
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
    expect(transformed.getProperties()?.extra).toBeDefined();
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

  it('applies drops to inline schema entries inside dictionaries', () => {
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
    ).toBeDefined();
    expect(map?.getProperties()?.first?.getProperties()?.keep).toBeDefined();
    expect(
      map?.getProperties()?.schema?.getProperties()?.minFields,
    ).toBeDefined();
  });

  it('drops escaped fields inside inline type definitions', () => {
    const repositoryVersions = ['R0', 'R1'] as const;
    const baseField = () =>
      new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

    const inlineBase = new BlueNode().setProperties({
      keep: baseField(),
    });
    const inlineCurrent = inlineBase
      .clone()
      .addProperty('a/b', baseField())
      .addProperty('tilda~x', baseField());

    const containerV0 = new BlueNode('Container').setProperties({
      field: new BlueNode().setType(inlineBase),
    });
    const containerV1 = new BlueNode('Container').setProperties({
      field: new BlueNode().setType(inlineCurrent),
    });

    const containerV0Id = BlueIdCalculator.calculateBlueIdSync(containerV0);
    const containerV1Id = BlueIdCalculator.calculateBlueIdSync(containerV1);

    const repository: BlueRepository = {
      name: 'repo.escape.inline',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Container': containerV1Id },
          typesMeta: {
            [containerV1Id]: {
              status: 'stable',
              name: 'Container',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: containerV0Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: containerV1Id,
                  attributesAdded: ['/field/type/a~1b', '/field/type/tilda~0x'],
                },
              ],
            },
          },
          contents: {
            [containerV1Id]: NodeToMapListOrValue.get(containerV1),
          },
          schemas: {},
        },
      },
    };

    const serializer = createSerializer({
      repositories: [repository],
      targetRepoVersionIndexes: { 'repo.escape.inline': 0 },
    });

    const rootType = containerV1.clone().setBlueId(containerV1Id);
    const node = new BlueNode().setType(rootType);
    node.setProperties({
      field: new BlueNode()
        .setType(
          new BlueNode().setProperties({
            keep: baseField(),
            'a/b': baseField(),
            'tilda~x': baseField(),
          }),
        )
        .setProperties({
          keep: textValue('keep'),
          'a/b': textValue('drop-a'),
          'tilda~x': textValue('drop-tilde'),
        }),
    });

    const transformed = serializer.transform(node);
    const schemaFieldType = transformed
      .getType()
      ?.getProperties()
      ?.field?.getType();
    const dataField = transformed.getProperties()?.field;
    const dataFieldType = dataField?.getType();
    expect(schemaFieldType?.getProperties()?.['a/b']).toBeUndefined();
    expect(schemaFieldType?.getProperties()?.['tilda~x']).toBeUndefined();
    expect(schemaFieldType?.getProperties()?.keep).toBeDefined();
    expect(dataFieldType?.getProperties()?.['a/b']).toBeUndefined();
    expect(dataFieldType?.getProperties()?.['tilda~x']).toBeUndefined();
    expect(dataField?.getProperties()?.['a/b']).toBeDefined();
    expect(dataField?.getProperties()?.['tilda~x']).toBeDefined();
  });

  it('preserves data fields with escaped pointer segments', () => {
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

    expect(fieldProps?.['a/b']).toBeDefined();
    expect(fieldProps?.['tilda~x']).toBeDefined();
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
