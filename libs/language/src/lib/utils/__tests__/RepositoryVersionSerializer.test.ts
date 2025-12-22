import { describe, expect, it } from 'vitest';
import { RepositoryVersionSerializer } from '../RepositoryVersionSerializer';
import { RepositoryRegistry } from '../../repository/RepositoryRuntime';
import { BlueNode } from '../../model';
import { NodeToMapListOrValue } from '../NodeToMapListOrValue';
import { BlueError, BlueErrorCode } from '../../errors/BlueError';
import type { BlueRepository } from '../../types/BlueRepository';
import {
  DICTIONARY_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../Properties';
import {
  ids,
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

  it('rejects types introduced after the target version', () => {
    const serializer = createSerializer({
      repositories: [repoBlue],
      targetRepoVersionIndexes: { 'repo.blue': 0 },
    });

    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.message),
    );
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
