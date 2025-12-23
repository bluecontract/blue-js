import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { Preprocessor } from '../Preprocessor';
import { TransformationProcessorProvider } from '../interfaces';
import { NodeProvider } from '../../NodeProvider';
import {
  INTEGER_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
  CORE_TYPE_NAME_TO_BLUE_ID_MAP,
} from '../../utils/Properties';
import { yamlBlueParse } from '../../../utils';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { BigIntegerNumber } from '../../model/BigIntegerNumber';
import { NodeTransformer } from '../../utils/NodeTransformer';
import { createBlueInstance, ids } from '../../__tests__/repositoryVersioning/fixtures';

class MockNodeProvider extends NodeProvider {
  override fetchByBlueId() {
    return [];
  }
}

describe('Preprocessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('testType - should preprocess a document with type attribute', async () => {
    const doc = `
a:
  type: Integer
b:
  type:
    value: Integer
c:
  type:
    blueId: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH`;

    const blue = new Blue();
    const node = blue.yamlToNode(doc);

    // Check that the type has been replaced with BlueId without inline value
    expect(node.getProperties()?.['a']?.getType()?.getBlueId()).toBe(
      CORE_TYPE_NAME_TO_BLUE_ID_MAP['Integer'],
    );

    expect(node.getProperties()?.['b']?.getType()?.getValue()).toBe('Integer');
    expect(node.getProperties()?.['c']?.getType()?.getBlueId()).toBe(
      '84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH',
    );

    // Check that none are inline values
    expect(node.getProperties()?.['a']?.getType()?.isInlineValue()).toBe(false);
    expect(node.getProperties()?.['b']?.getType()?.isInlineValue()).toBe(false);
    expect(node.getProperties()?.['c']?.getType()?.isInlineValue()).toBe(false);
  });

  it('testItemsAsBlueId - should preprocess items as BlueId', async () => {
    const doc = `
name: Abc
items:
  blueId: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH`;

    const blue = new Blue();
    const parsedYaml = yamlBlueParse(doc);
    const node = NodeDeserializer.deserialize(parsedYaml ?? '');
    const processedNode = blue.preprocess(node);

    expect(processedNode.getItems()?.[0].getBlueId()).toBe(
      '84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH',
    );
  });

  it('testPreprocessWithCustomBlueExtendingDefaultBlue- should preprocess with custom Blue extending default Blue using NodeTransformer', async () => {
    const doc = `
    blue:
      - blueId: ${Preprocessor.DEFAULT_BLUE_BLUE_ID}
      - name: MyTestTransformation
    x:
      type: Integer
    y: ABC`;

    const parsedYaml = yamlBlueParse(doc);
    const node = NodeDeserializer.deserialize(parsedYaml ?? '');

    // Create transformer function that changes 'ABC' to 'XYZ'
    const transformer = (node: BlueNode): BlueNode => {
      const result = node.clone();

      if (result.getValue() === 'ABC') {
        result.setValue('XYZ');
      }

      return result;
    };

    // Create custom processor provider
    const provider: TransformationProcessorProvider = {
      getProcessor: (transformation) => {
        if (transformation.getName() === 'MyTestTransformation') {
          return {
            process: (document) => {
              return NodeTransformer.transform(document, transformer);
            },
          };
        }
        return Preprocessor.getStandardProvider().getProcessor(transformation);
      },
    };

    const nodeProvider = new MockNodeProvider();
    const preprocessor = new Preprocessor({
      processorProvider: provider,
      nodeProvider: nodeProvider,
    });
    const result = preprocessor.preprocess(node);

    expect(await result.get('/x/type/blueId')).toBe(INTEGER_TYPE_BLUE_ID);
    expect(await result.get('/y/value')).toBe('XYZ');
  });

  it('testTypeConsistencyAfterMultiplePreprocessing- should maintain type consistency after multiple preprocessing', async () => {
    const doc = `
a:
  type: Text
b:
  type:
    blueId: ${TEXT_TYPE_BLUE_ID}`;

    const blue = new Blue();
    const parsedYaml = yamlBlueParse(doc);
    const node = NodeDeserializer.deserialize(parsedYaml ?? '');

    const preprocessedOnce = blue.preprocess(node);
    const preprocessedTwice = blue.preprocess(preprocessedOnce);

    const aTypeBlueId = preprocessedTwice
      .getProperties()
      ?.['a']?.getType()
      ?.getBlueId();
    const bTypeBlueId = preprocessedTwice
      .getProperties()
      ?.['b']?.getType()
      ?.getBlueId();

    expect(aTypeBlueId).toBe(bTypeBlueId);
    expect(preprocessedOnce.getBlueId()).toBe(preprocessedTwice.getBlueId());
  });

  it('testNodeProcessingAndDeserialization- should properly process and deserialize nodes', async () => {
    const doc = `
x: 1
y:
  value: 1
z:
  type: Integer
  value: 1
v:
  type:
    blueId: ${INTEGER_TYPE_BLUE_ID}
  value: 1`;

    const blue = new Blue();

    const preprocessedNode = blue.yamlToNode(doc);
    const expectedPreprocessed = new BlueNode()
      .setProperties({
        x: new BlueNode()
          .setType(
            new BlueNode()
              .setBlueId(INTEGER_TYPE_BLUE_ID)
              .setInlineValue(false),
          )
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(true),
        y: new BlueNode()
          .setType(
            new BlueNode()
              .setBlueId(INTEGER_TYPE_BLUE_ID)
              .setInlineValue(false),
          )
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(false),
        z: new BlueNode()
          .setType(
            new BlueNode()
              .setBlueId(INTEGER_TYPE_BLUE_ID)
              .setInlineValue(false),
          )
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(false),
        v: new BlueNode()
          .setType(
            new BlueNode()
              .setBlueId(INTEGER_TYPE_BLUE_ID)
              .setInlineValue(false),
          )
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(false),
      })
      .setInlineValue(false);

    assertNodesEqual(expectedPreprocessed, preprocessedNode);

    const parsedYaml = yamlBlueParse(doc);
    const rawNode = NodeDeserializer.deserialize(parsedYaml ?? '');

    const expectedRaw = new BlueNode()
      .setProperties({
        x: new BlueNode()
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(true),
        y: new BlueNode()
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(false),
        z: new BlueNode()
          .setType(new BlueNode().setValue('Integer').setInlineValue(true))
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(false),
        v: new BlueNode()
          .setType(
            new BlueNode()
              .setBlueId(INTEGER_TYPE_BLUE_ID)
              .setInlineValue(false),
          )
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(false),
      })
      .setInlineValue(false);

    assertNodesEqual(expectedRaw, rawNode);
  });

  it('resolves <package>/<Type> aliases during preprocessing', () => {
    const blue = createBlueInstance();
    const yaml = `
type: myos/Policy
owner:
  type: Text
  value: owner-1
rules:
  - type: myos/Rule
    when: { value: 'when-1' }
    then: { value: 'then-1' }
`;
    const node = blue.yamlToNode(yaml);
    const rule = node.getProperties()?.rules?.getItems()?.[0];

    expect(node.getType()?.getBlueId()).toEqual(ids.policyCurrent);
    expect(rule?.getType()?.getBlueId()).toEqual(ids.ruleCurrent);
  });

  it('resolves aliases in itemType/valueType/keyType references', () => {
    const blue = createBlueInstance();
    const yaml = `
type: myos/Policy
owner:
  type: Text
  value: owner-1
valueDict:
  keyType: Text
  valueType: myos/Rule
  first:
    type: myos/Rule
    when: { value: 'when-1' }
    then: { value: 'then-1' }
listRules:
  itemType:
    type: myos/Rule
  items:
    - type: myos/Rule
      when: { value: 'lw' }
      then: { value: 'lt' }
`;
    const node = blue.yamlToNode(yaml);
    const valueDict = node.getProperties()?.valueDict;
    const listRules = node.getProperties()?.listRules;

    expect(valueDict?.getValueType()?.getBlueId()).toEqual(ids.ruleCurrent);
    expect(valueDict?.getKeyType()?.getBlueId()).toEqual(ids.text);
    expect(valueDict?.getProperties()?.first?.getType()?.getBlueId()).toEqual(
      ids.ruleCurrent,
    );
    expect(listRules?.getItemType()?.getType()?.getBlueId()).toEqual(
      ids.ruleCurrent,
    );
    expect(listRules?.getItems()?.[0]?.getType()?.getBlueId()).toEqual(
      ids.ruleCurrent,
    );
  });

  it('testTypeConsistencyAfterMultiplePreprocessingWithMappings- should maintain type consistency after multiple preprocessing with mappings', async () => {
    const doc = `
    blue: 
      - type:
          blueId: 27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo
        mappings:
          Text: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
          Double: 7pwXmXYCJtWnd348c2JQGBkm9C4renmZRwxbfaypsx5y
          Integer: 5WNMiV9Knz63B4dVY5JtMyh3FB4FSGqv7ceScvuapdE1
          Boolean: 4EzhSubEimSQD3zrYHRtobfPPWntUuhEz8YcdxHsi12u
          List: 6aehfNAxHLC1PHHoDr3tYtFH3RWNbiWdFancJ1bypXEY
          Dictionary: G7fBT9PSod1RfHLHkpafAGBDVAJMrMhAMY51ERcyXNrj
          Person: 8xYi5Svou5DVawB7CDEGuZitUGFChRYcJUF67bQ3NfXt
      - type:
          blueId: FGYuTXwaoSKfZmpTysLTLsb8WzSqf43384rKZDkXhxD4
    a:
      type: Person
    b:
      type:
        blueId: 8xYi5Svou5DVawB7CDEGuZitUGFChRYcJUF67bQ3NfXt
    `;

    const blue = new Blue();
    const parsedYaml = yamlBlueParse(doc);
    const node = NodeDeserializer.deserialize(parsedYaml ?? '');
    const preprocessedNode = blue.preprocess(node);

    const aTypeBlueId = preprocessedNode
      .getProperties()
      ?.['a']?.getType()
      ?.getBlueId();

    const bTypeBlueId = preprocessedNode
      .getProperties()
      ?.['b']?.getType()
      ?.getBlueId();

    expect(aTypeBlueId).toBe(bTypeBlueId);
  });

  it('should throw error for unknown types in all type fields', () => {
    // Test all type fields in one comprehensive test
    const testCases = [
      {
        doc: 'a:\n  type: UnknownType',
        field: 'type',
        expectedError:
          'Unknown type "UnknownType" found in type field. No BlueId mapping exists for this type.',
      },
      {
        doc: 'myList:\n  itemType: UnknownItemType',
        field: 'itemType',
        expectedError:
          'Unknown type "UnknownItemType" found in itemType field. No BlueId mapping exists for this type.',
      },
      {
        doc: 'myMap:\n  keyType: UnknownKeyType',
        field: 'keyType',
        expectedError:
          'Unknown type "UnknownKeyType" found in keyType field. No BlueId mapping exists for this type.',
      },
      {
        doc: 'myMap:\n  valueType: UnknownValueType',
        field: 'valueType',
        expectedError:
          'Unknown type "UnknownValueType" found in valueType field. No BlueId mapping exists for this type.',
      },
    ];

    const blue = new Blue();

    testCases.forEach(({ doc, field, expectedError }) => {
      const parsedYaml = yamlBlueParse(doc);
      const node = NodeDeserializer.deserialize(parsedYaml ?? '');

      expect(() => blue.preprocess(node)).toThrow(expectedError);
    });
  });

  it('should process all known type fields without error', () => {
    const doc = `
    a:
      type: Integer
    b:
      type: Text
    c:
      itemType: Boolean
    d:
      keyType: Text
      valueType: Double
    `;

    const blue = new Blue();
    const parsedYaml = yamlBlueParse(doc);
    const node = NodeDeserializer.deserialize(parsedYaml ?? '');

    // Should not throw any error
    const preprocessedNode = blue.preprocess(node);

    // Verify that types were properly converted to BlueIds
    expect(
      preprocessedNode.getProperties()?.['a']?.getType()?.getBlueId(),
    ).toBe(INTEGER_TYPE_BLUE_ID);
    expect(
      preprocessedNode.getProperties()?.['b']?.getType()?.getBlueId(),
    ).toBe(TEXT_TYPE_BLUE_ID);
  });

  it('should handle complex nested type structures without throwing errors', () => {
    const doc = `
    a:
      type:
        name: A
        type: 
          name: B
          type: Integer
    b:
      type:
        blueId: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH
        someProperty:
          type: Text
    `;

    const blue = new Blue();
    const parsedYaml = yamlBlueParse(doc);
    const node = NodeDeserializer.deserialize(parsedYaml ?? '');

    // Should not throw any error because these are not inline values
    const preprocessedNode = blue.preprocess(node);

    // Verify structure is preserved
    const aType = preprocessedNode.getProperties()?.['a']?.getType();
    expect(aType?.getName()).toBe('A');
    expect(aType?.getType()?.getName()).toBe('B');
    expect(aType?.getType()?.getType()?.getBlueId()).toBe(INTEGER_TYPE_BLUE_ID);

    const bType = preprocessedNode.getProperties()?.['b']?.getType();
    expect(bType?.getBlueId()).toBe(
      '84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH',
    );

    expect(
      bType?.getProperties()?.['someProperty']?.getType()?.getBlueId(),
    ).toBe(TEXT_TYPE_BLUE_ID);
  });

  it('should throw error for first unknown type encountered in complex structures', () => {
    const doc = `
    myNode:
      type:
        name: ComplexType
        type: UnknownType
        validProp:
          type: Integer
        invalidProp:
          type: UnknownPropertyType
    `;

    const blue = new Blue();
    const parsedYaml = yamlBlueParse(doc);
    const node = NodeDeserializer.deserialize(parsedYaml ?? '');

    // Should throw error for the first unknown inline type encountered
    // The processor encounters "UnknownType" before "UnknownPropertyType"
    expect(() => blue.preprocess(node)).toThrow(
      'Unknown type "UnknownType" found in type field. No BlueId mapping exists for this type.',
    );
  });

  it('should throw error for unknown types in nested properties', () => {
    const doc = `
    myNode:
      type:
        name: ComplexType
        type: Integer
        validProp:
          type: Integer
        invalidProp:
          type: UnknownPropertyType
    `;

    const blue = new Blue();
    const parsedYaml = yamlBlueParse(doc);
    const node = NodeDeserializer.deserialize(parsedYaml ?? '');

    expect(() => blue.preprocess(node)).toThrow(
      'Unknown type "UnknownPropertyType" found in type field. No BlueId mapping exists for this type.',
    );
  });

  it('should throw error for unknown types in lists with mixed type definitions', () => {
    const doc = `
    items:
      - type: Integer
      - type:
          name: ComplexItem
          type: Text
      - type: UnknownListType
    `;

    const blue = new Blue();
    const parsedYaml = yamlBlueParse(doc);
    const node = NodeDeserializer.deserialize(parsedYaml ?? '');

    expect(() => blue.preprocess(node)).toThrow(
      'Unknown type "UnknownListType" found in type field. No BlueId mapping exists for this type.',
    );
  });

  // Helper function to assert nodes equality, similar to Java version
  function assertNodesEqual(expected: BlueNode, actual: BlueNode) {
    expect(actual.isInlineValue()).toBe(expected.isInlineValue());

    expect(actual.getValue()).toEqual(expected.getValue());

    const actualType = actual.getType();
    const expectedType = expected.getType();
    if (expectedType) {
      expect(actualType).not.toBeUndefined();
      if (actualType) {
        assertNodesEqual(expectedType, actualType);
      }
    } else {
      expect(actualType).toBeUndefined();
    }

    const expectedProps = expected.getProperties();
    const actualProps = actual.getProperties();
    if (expectedProps) {
      expect(actualProps).not.toBeUndefined();

      if (expectedProps && actualProps) {
        expect(Object.keys(actualProps).length).toBe(
          Object.keys(expectedProps).length,
        );

        for (const key in expectedProps) {
          expect(actualProps).toHaveProperty(key);
          assertNodesEqual(expectedProps[key], actualProps[key]);
        }
      }
    } else {
      expect(actualProps).toBeUndefined();
    }

    expect(actual.getBlueId()).toBe(expected.getBlueId());
  }
});
