import { describe, it, expect } from 'vitest';
import { Blue } from '../Blue';
import { BlueNode } from '../model';
import type { BlueRepository } from '../types/BlueRepository';
import type { JsonValue } from '@blue-labs/shared-utils';
import { BasicNodeProvider, RepositoryBasedNodeProvider } from '../provider';
import { TEXT_TYPE_BLUE_ID } from '../utils/Properties';

describe('Blue.restoreInlineTypes', () => {
  it('restores inline types for core mappings without mutating original node', () => {
    const { blue } = createSemanticSeedBlue();

    const node = blue.jsonValueToNode({
      field: {
        type: 'Text',
        value: 'sample',
      },
    });

    const originalType = node.getProperties()?.field?.getType();
    expect(originalType?.getBlueId()).toBe(TEXT_TYPE_BLUE_ID);
    expect(originalType?.isInlineValue()).toBe(false);

    const restored = blue.restoreInlineTypes(node);

    // Original node should remain unchanged
    expect(node.getProperties()?.field?.getType()?.getBlueId()).toBe(
      TEXT_TYPE_BLUE_ID,
    );

    const restoredType = restored.getProperties()?.field?.getType();
    expect(restoredType?.isInlineValue()).toBe(true);
    expect(restoredType?.getValue()).toBe('Text');
    expect(restoredType?.getBlueId()).toBeUndefined();

    expect(blue.nodeToJson(restored)).toMatchInlineSnapshot(`
      {
        "field": {
          "type": {
            "type": {
              "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
            },
            "value": "Text",
          },
          "value": "sample",
        },
      }
    `);
  });

  it('restores inline types using registered BlueIds', () => {
    const { blue, registerType } = createSemanticSeedBlue();

    const linkDefinition = {
      name: 'Link',
      anchor: {
        type: 'Text',
      },
    } as const;

    const linkNode = blue.jsonValueToNode(linkDefinition);
    const { blueId: linkBlueId } = registerType('Link', linkNode);

    const document = blue.jsonValueToNode({
      reference: {
        type: 'Link',
      },
    });

    expect(document.getProperties()?.reference?.getType()?.getBlueId()).toBe(
      linkBlueId,
    );

    const restored = blue.restoreInlineTypes(document);
    const restoredType = restored.getProperties()?.reference?.getType();

    expect(restoredType?.isInlineValue()).toBe(true);
    expect(restoredType?.getValue()).toBe('Link');

    expect(blue.nodeToJson(restored)).toMatchInlineSnapshot(`
      {
        "reference": {
          "type": {
            "type": {
              "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
            },
            "value": "Link",
          },
        },
      }
    `);
  });

  it('restores inline types on resolved nodes using repository data', () => {
    const { blue, registerType } = createSemanticSeedBlue();

    const baseTypeDefinition = {
      name: 'Base Type',
      description: 'Reusable contract',
      label: {
        type: 'Text',
      },
    } as const;

    const baseTypeNode = blue.jsonValueToNode(baseTypeDefinition);
    const { blueId: baseTypeBlueId, json: baseTypeJson } = registerType(
      'Base Type',
      baseTypeNode,
    );

    const repository: BlueRepository = buildTestRepository([
      {
        name: 'Base Type',
        blueId: baseTypeBlueId,
        json: baseTypeJson,
      },
    ]);

    blue.setNodeProvider(new RepositoryBasedNodeProvider([repository]));

    const document = blue.jsonValueToNode({
      contract: {
        type: 'Base Type',
        label: 'Test',
      },
    });

    const resolved = blue.resolve(document);
    const restoredResolved = blue.restoreInlineTypes(resolved);

    const contractType = restoredResolved.getProperties()?.contract?.getType();
    expect(contractType?.isInlineValue()).toBe(true);
    expect(contractType?.getValue()).toBe('Base Type');

    const labelType = restoredResolved
      .getProperties()
      ?.contract?.getProperties()
      ?.label?.getType();
    expect(labelType?.isInlineValue()).toBe(true);
    expect(labelType?.getValue()).toBe('Text');

    expect(blue.nodeToJson(restoredResolved)).toMatchInlineSnapshot(`
      {
        "contract": {
          "label": {
            "type": {
              "type": {
                "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
              },
              "value": "Text",
            },
            "value": "Test",
          },
          "type": {
            "type": {
              "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
            },
            "value": "Base Type",
          },
        },
      }
    `);
  });

  it('restores inline types for resolved nodes with nested collections', () => {
    const { blue, registerType } = createSemanticSeedBlue();

    const optionDefinition = {
      name: 'Option',
      label: {
        type: 'Text',
      },
      code: {
        type: 'Text',
      },
    } as const;

    const optionNode = blue.jsonValueToNode(optionDefinition);
    const { blueId: optionBlueId, json: optionJson } = registerType(
      'Option',
      optionNode,
    );

    const formDefinition = {
      name: 'Form',
      title: {
        type: 'Text',
      },
      options: {
        type: 'List',
        itemType: {
          blueId: optionBlueId,
        },
      },
      attributes: {
        type: 'Dictionary',
        keyType: 'Text',
        valueType: 'Text',
      },
    } as const;

    const formNode = blue.jsonValueToNode(formDefinition);
    const { blueId: formBlueId, json: formJson } = registerType(
      'Form',
      formNode,
    );

    const repository: BlueRepository = buildTestRepository([
      {
        name: 'Option',
        blueId: optionBlueId,
        json: optionJson,
      },
      { name: 'Form', blueId: formBlueId, json: formJson },
    ]);

    blue.setNodeProvider(new RepositoryBasedNodeProvider([repository]));

    const document = blue.jsonValueToNode({
      name: 'Registration',
      type: 'Form',
      options: [
        {
          type: 'Option',
          label: 'Marketing',
          code: 'marketing',
        },
        {
          type: 'Option',
          label: 'Sales',
          code: 'sales',
        },
      ],
      attributes: {
        required: 'true',
      },
    });

    const resolved = blue.resolve(document);
    const restoredResolved = blue.restoreInlineTypes(resolved);

    expect(resolved.getType()?.getBlueId()).toBe(formBlueId);
    expect(resolved.getType()?.isInlineValue()).toBe(false);

    const restoredType = restoredResolved.getType();
    expect(restoredType?.isInlineValue()).toBe(true);
    expect(restoredType?.getValue()).toBe('Form');

    const optionsNode = restoredResolved.getProperties()?.options;
    expect(optionsNode).toBeDefined();

    const optionsItemType = optionsNode?.getItemType();
    expect(optionsItemType?.isInlineValue()).toBe(true);
    expect(optionsItemType?.getValue()).toBe('Option');

    const optionItems = optionsNode?.getItems() ?? [];
    expect(optionItems).toHaveLength(2);
    optionItems.forEach((optionItem) => {
      expect(optionItem.getType()?.isInlineValue()).toBe(true);
      expect(optionItem.getType()?.getValue()).toBe('Option');
    });

    const attributesNode = restoredResolved.getProperties()?.attributes;
    expect(attributesNode).toBeDefined();

    const keyType = attributesNode?.getKeyType();
    expect(keyType?.isInlineValue()).toBe(true);
    expect(keyType?.getValue()).toBe('Text');

    const valueType = attributesNode?.getValueType();
    expect(valueType?.isInlineValue()).toBe(true);
    expect(valueType?.getValue()).toBe('Text');

    const requiredEntryType = attributesNode
      ?.getProperties()
      ?.required?.getType();
    expect(requiredEntryType?.isInlineValue()).toBe(true);
    expect(requiredEntryType?.getValue()).toBe('Text');

    expect(blue.nodeToJson(restoredResolved, 'official'))
      .toMatchInlineSnapshot(`
        {
          "attributes": {
            "keyType": {
              "type": {
                "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
              },
              "value": "Text",
            },
            "required": {
              "type": {
                "type": {
                  "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
                },
                "value": "Text",
              },
              "value": "true",
            },
            "type": {
              "type": {
                "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
              },
              "value": "Dictionary",
            },
            "valueType": {
              "type": {
                "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
              },
              "value": "Text",
            },
          },
          "name": "Registration",
          "options": {
            "itemType": {
              "type": {
                "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
              },
              "value": "Option",
            },
            "items": [
              {
                "code": {
                  "type": {
                    "type": {
                      "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
                    },
                    "value": "Text",
                  },
                  "value": "marketing",
                },
                "label": {
                  "type": {
                    "type": {
                      "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
                    },
                    "value": "Text",
                  },
                  "value": "Marketing",
                },
                "type": {
                  "type": {
                    "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
                  },
                  "value": "Option",
                },
              },
              {
                "code": {
                  "type": {
                    "type": {
                      "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
                    },
                    "value": "Text",
                  },
                  "value": "sales",
                },
                "label": {
                  "type": {
                    "type": {
                      "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
                    },
                    "value": "Text",
                  },
                  "value": "Sales",
                },
                "type": {
                  "type": {
                    "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
                  },
                  "value": "Option",
                },
              },
            ],
            "type": {
              "type": {
                "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
              },
              "value": "List",
            },
          },
          "title": {
            "type": {
              "type": {
                "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
              },
              "value": "Text",
            },
          },
          "type": {
            "type": {
              "blueId": "DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K",
            },
            "value": "Form",
          },
        }
      `);

    expect(blue.nodeToJson(restoredResolved, 'simple')).toMatchInlineSnapshot(`
      {
        "attributes": {
          "keyType": "Text",
          "required": "true",
          "type": "Dictionary",
          "valueType": "Text",
        },
        "name": "Registration",
        "options": [
          {
            "code": "marketing",
            "label": "Marketing",
            "type": "Option",
          },
          {
            "code": "sales",
            "label": "Sales",
            "type": "Option",
          },
        ],
        "title": {
          "type": "Text",
        },
        "type": "Form",
      }
    `);
  });

  it('keeps inherited values after restoring inline types', () => {
    const { blue, registerType } = createSemanticSeedBlue();

    const baseDefinition = {
      name: 'Base Preferences',
      enabled: {
        type: 'Boolean',
        value: true,
      },
      retries: {
        type: 'Integer',
        value: 3,
      },
    } as const;

    const derivedDefinition = {
      name: 'Derived Preferences',
      type: 'Base Preferences',
      notes: {
        type: 'Text',
      },
    } as const;

    const baseNode = blue.jsonValueToNode(baseDefinition);
    const { blueId: baseBlueId, json: baseJson } = registerType(
      'Base Preferences',
      baseNode,
    );

    const derivedNode = blue.jsonValueToNode(derivedDefinition);
    const { blueId: derivedBlueId, json: derivedJson } = registerType(
      'Derived Preferences',
      derivedNode,
    );

    const repository: BlueRepository = buildTestRepository([
      {
        name: 'Base Preferences',
        blueId: baseBlueId,
        json: baseJson,
      },
      {
        name: 'Derived Preferences',
        blueId: derivedBlueId,
        json: derivedJson,
      },
    ]);

    blue.setNodeProvider(new RepositoryBasedNodeProvider([repository]));

    const document = blue.jsonValueToNode({
      name: 'Runtime Preferences',
      type: 'Derived Preferences',
      notes: 'Customized behaviour',
    });

    const resolved = blue.resolve(document);
    const restoredResolved = blue.restoreInlineTypes(resolved);

    const resolvedType = restoredResolved.getType();
    expect(resolvedType?.isInlineValue()).toBe(true);
    expect(resolvedType?.getValue()).toBe('Derived Preferences');

    const enabledNode = restoredResolved.getProperties()?.enabled;
    expect(enabledNode?.getValue()).toBe(true);
    expect(enabledNode?.getType()?.isInlineValue()).toBe(true);
    expect(enabledNode?.getType()?.getValue()).toBe('Boolean');

    const retriesNode = restoredResolved.getProperties()?.retries;
    expect(retriesNode?.getValue()?.toString()).toBe('3');
    expect(retriesNode?.getType()?.isInlineValue()).toBe(true);
    expect(retriesNode?.getType()?.getValue()).toBe('Integer');

    const notesNode = restoredResolved.getProperties()?.notes;
    expect(notesNode?.getType()?.isInlineValue()).toBe(true);
    expect(notesNode?.getType()?.getValue()).toBe('Text');

    expect(blue.nodeToJson(restoredResolved, 'simple')).toMatchInlineSnapshot(`
      {
        "enabled": true,
        "name": "Runtime Preferences",
        "notes": "Customized behaviour",
        "retries": 3,
        "type": "Derived Preferences",
      }
    `);
  });
});

function createSemanticSeedBlue(): {
  blue: Blue;
  registerType: (
    name: string,
    node: BlueNode,
  ) => { blueId: string; json: JsonValue };
} {
  const provider = new BasicNodeProvider();
  const blue = new Blue({ nodeProvider: provider });

  return {
    blue,
    registerType(name: string, node: BlueNode) {
      provider.addSingleNodes(node);
      const blueId = provider.getBlueIdByName(name);
      blue.registerBlueIds({ [name]: blueId });
      const storedNode = provider.fetchFirstByBlueId(blueId);
      if (!storedNode) {
        throw new Error(`Expected semantic storage content for ${name}.`);
      }
      const json = blue.nodeToJson(storedNode) as JsonValue;
      return { blueId, json };
    },
  };
}

function buildTestRepository(
  types: Array<{ name: string; blueId: string; json: JsonValue }>,
): BlueRepository {
  const typesMeta = Object.fromEntries(
    types.map(({ name, blueId }) => [
      blueId,
      {
        status: 'stable' as const,
        name,
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: blueId,
            attributesAdded: [],
          },
        ],
      },
    ]),
  );

  const contents = Object.fromEntries(
    types.map(({ blueId, json }) => [blueId, json]),
  );

  return {
    name: 'test.repo',
    repositoryVersions: ['R0'],
    packages: {
      test: {
        name: 'test',
        aliases: {},
        typesMeta,
        contents,
        schemas: {},
      },
    },
  };
}
