import { describe, expect, it } from 'vitest';
import { Blue } from '../Blue';
import { BlueNode, SCHEMA_FIELDS, Schema } from '../model';
import {
  BUILTIN_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP,
  BUILTIN_RUNTIME_TYPES_REPOSITORY,
} from '../repository/BuiltinRuntimeTypes';
import type { BlueRepository } from '../types/BlueRepository';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { NodeToMapListOrValue } from '../utils/NodeToMapListOrValue';
import {
  INTEGER_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../utils/Properties';

const JSON_PATCH_ENTRY_BLUE_ID =
  BUILTIN_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP['Json Patch Entry'];

function buildWorkflowStepRepository(): {
  repository: BlueRepository;
  updateDocumentBlueId: string;
} {
  const updateDocument = new BlueNode('Update Document').setProperties({
    changeset: new BlueNode()
      .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
      .setItemType(new BlueNode().setBlueId(JSON_PATCH_ENTRY_BLUE_ID)),
  });
  const updateDocumentBlueId =
    BlueIdCalculator.calculateBlueIdSync(updateDocument);

  return {
    repository: {
      name: 'repo.workflow',
      repositoryVersions: ['repo-workflow-v1'],
      packages: {
        core: {
          name: 'core',
          aliases: {
            'core/Update Document': updateDocumentBlueId,
          },
          typesMeta: {
            [updateDocumentBlueId]: {
              status: 'stable',
              name: 'Update Document',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: updateDocumentBlueId,
                  attributesAdded: [],
                },
              ],
            },
          },
          contents: {
            [updateDocumentBlueId]: NodeToMapListOrValue.get(updateDocument),
          },
          schemas: {},
        },
      },
    },
    updateDocumentBlueId,
  };
}

describe('Blue.nodeToJson', () => {
  it('preserves materialized blueId plus payload by default', () => {
    const blue = new Blue();
    const node = new BlueNode()
      .setBlueId('MaterializedId')
      .setName('Materialized')
      .setValue('payload');

    expect(blue.nodeToJson(node)).toEqual({
      name: 'Materialized',
      type: { blueId: TEXT_TYPE_BLUE_ID },
      value: 'payload',
      blueId: 'MaterializedId',
    });
  });

  it('emits blueId for exact references in reference-only mode', () => {
    const blue = new Blue();

    expect(blue.nodeToJson(new BlueNode().setBlueId('ExactReference'))).toEqual(
      {
        blueId: 'ExactReference',
      },
    );
  });

  it('preserves materialized blueId plus payload through options form', () => {
    const blue = new Blue();
    const node = new BlueNode()
      .setBlueId('MaterializedId')
      .setName('Materialized')
      .setValue('payload');

    expect(blue.nodeToJson(node, { format: 'official' })).toEqual({
      name: 'Materialized',
      type: { blueId: TEXT_TYPE_BLUE_ID },
      value: 'payload',
      blueId: 'MaterializedId',
    });
  });

  it('serializes boolean schema keywords as round-trippable booleans', () => {
    const blue = new Blue();
    const node = new BlueNode('RequiredField')
      .setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
      .setSchema(
        new Schema()
          .set('required', new BlueNode().setValue(true))
          .set('uniqueItems', new BlueNode().setValue(false)),
      );

    const json = blue.nodeToJson(node);
    expect(json).toMatchObject({
      schema: {
        required: true,
        uniqueItems: false,
      },
    });
    expect(() => blue.jsonValueToNode(json)).not.toThrow();
  });

  it('serializes all schema keywords in parser-compatible shapes', () => {
    const blue = new Blue();
    const schema = new Schema()
      .set('required', new BlueNode().setValue(true))
      .set('minLength', new BlueNode().setValue(1))
      .set('maxLength', new BlueNode().setValue(10))
      .set('minimum', new BlueNode().setValue(1.5))
      .set('maximum', new BlueNode().setValue(100.5))
      .set('exclusiveMinimum', new BlueNode().setValue(1))
      .set('exclusiveMaximum', new BlueNode().setValue(101))
      .set('multipleOf', new BlueNode().setValue(0.5))
      .set('minItems', new BlueNode().setValue(1))
      .set('maxItems', new BlueNode().setValue(5))
      .set('uniqueItems', new BlueNode().setValue(false))
      .set('minFields', new BlueNode().setValue(1))
      .set('maxFields', new BlueNode().setValue(4))
      .setEnum([
        new BlueNode().setValue('basic'),
        new BlueNode().setValue('premium'),
      ]);
    const node = new BlueNode('SchemaCarrier')
      .setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
      .setSchema(schema);

    const json = blue.nodeToJson(node);
    const serializedSchema = (json as { schema?: Record<string, unknown> })
      .schema;

    expect(Object.keys(serializedSchema ?? {}).sort()).toEqual(
      [...SCHEMA_FIELDS, 'enum'].sort(),
    );

    expect(json).toMatchObject({
      schema: {
        required: true,
        minLength: 1,
        maxLength: 10,
        minimum: 1.5,
        maximum: 100.5,
        exclusiveMinimum: 1,
        exclusiveMaximum: 101,
        multipleOf: 0.5,
        minItems: 1,
        maxItems: 5,
        uniqueItems: false,
        minFields: 1,
        maxFields: 4,
        enum: ['basic', 'premium'],
      },
    });
    expect(() => blue.jsonValueToNode(json)).not.toThrow();
  });

  it('serializes explicit typed numeric schema nodes as round-trippable explicit scalar nodes', () => {
    const blue = new Blue();
    const node = new BlueNode('SchemaCarrier')
      .setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
      .setSchema(
        new Schema().set(
          'minimum',
          new BlueNode()
            .setType(new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID))
            .setValue('1'),
        ),
      );

    const json = blue.nodeToJson(node);

    expect(json).toMatchObject({
      schema: {
        minimum: {
          type: { blueId: INTEGER_TYPE_BLUE_ID },
          value: 1,
        },
      },
    });
    expect(() => blue.jsonValueToNode(json)).not.toThrow();
  });

  it('does not flatten invalid numeric schema nodes that carry metadata', () => {
    const blue = new Blue();
    const node = new BlueNode('SchemaCarrier')
      .setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
      .setSchema(
        new Schema().set(
          'minimum',
          new BlueNode('Documented minimum').setValue(1),
        ),
      );

    const json = blue.nodeToJson(node);

    expect(json).toMatchObject({
      schema: {
        minimum: {
          name: 'Documented minimum',
          value: 1,
        },
      },
    });
    expect(() => blue.jsonValueToNode(json)).toThrow(/schema.minimum/);
  });

  it('keeps repository-context expanded schema keywords round-trippable', () => {
    const blue = new Blue();
    const document = {
      contracts: {
        initialized: {
          type: {
            blueId: '6JjyUKoK7uJxA5NY9YhMaKJbXC6c9iHyx1khv4gaAq4Q',
          },
          documentId: {
            type: {
              blueId: TEXT_TYPE_BLUE_ID,
            },
            value: 'EeiZPKxvEf2JFg4cVkKkYKcytg9224Hoaeio46xWQpeP',
          },
        },
      },
    };

    const json = blue.nodeToJson(blue.jsonValueToNode(document), {
      format: 'official',
      blueContext: {
        repositories: {
          [BUILTIN_RUNTIME_TYPES_REPOSITORY.name]:
            BUILTIN_RUNTIME_TYPES_REPOSITORY.repositoryVersions[0],
        },
      },
    });

    expect(() => blue.resolve(blue.jsonValueToNode(json))).not.toThrow();
  });

  it('treats bundled runtime types as known when exporting repository-context documents', () => {
    const { repository, updateDocumentBlueId } = buildWorkflowStepRepository();
    const blue = new Blue({ repositories: [repository] });
    const document = new BlueNode()
      .setType(new BlueNode().setBlueId(updateDocumentBlueId))
      .setProperties({
        changeset: new BlueNode().setItems([
          new BlueNode()
            .setType(new BlueNode().setBlueId(JSON_PATCH_ENTRY_BLUE_ID))
            .setProperties({
              op: new BlueNode().setValue('replace'),
              path: new BlueNode().setValue('/status'),
              val: new BlueNode().setValue('secured'),
            }),
        ]),
      });

    const json = blue.nodeToJson(document, {
      format: 'official',
      blueContext: {
        repositories: {
          [repository.name]: repository.repositoryVersions[0],
        },
        fallbackToCurrentInlineDefinitions: false,
      },
    }) as {
      changeset?: { items?: Array<{ type?: { blueId?: string } }> };
    };

    expect(json.changeset?.items?.[0]?.type).toEqual({
      blueId: JSON_PATCH_ENTRY_BLUE_ID,
    });
    expect(() => blue.resolve(blue.jsonValueToNode(json))).not.toThrow();
  });
});
