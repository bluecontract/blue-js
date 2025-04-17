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
      CORE_TYPE_NAME_TO_BLUE_ID_MAP['Integer']
    );

    expect(node.getProperties()?.['b']?.getType()?.getValue()).toBe('Integer');
    expect(node.getProperties()?.['c']?.getType()?.getBlueId()).toBe(
      '84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH'
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
      '84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH'
    );
  });

  it('testPreprocessWithCustomBlueExtendingDefaultBlue- should preprocess with custom Blue extending default Blue using NodeTransformer', async () => {
    const doc = `
blue:
  - type:
      blueId: 27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo
    mappings:
      Text: F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP
      Double: 68ryJtnmui4j5rCZWUnkZ3DChtmEb7Z9F8atn1mBSM3L
      Integer: DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8
      Boolean: EL6AjrbJsxTWRTPzY8WR8Y2zAMXRbydQj83PcZwuAHbo
      List: G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB
      Dictionary: 294NBTj2mFRL3RB4kDRUSckwGg7Kzj6T8CTAFeR1kcSA
  - type:
      blueId: FGYuTXwaoSKfZmpTysLTLsb8WzSqf43384rKZDkXhxD4
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
              // Use NodeTransformer to transform the document
              return NodeTransformer.transform(document, transformer);
            },
          };
        }
        return Preprocessor.getStandardProvider().getProcessor(transformation);
      },
    };

    const nodeProvider = new MockNodeProvider();
    const preprocessor = new Preprocessor(provider, nodeProvider);
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
            new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID).setInlineValue(false)
          )
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(true),
        y: new BlueNode()
          .setType(
            new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID).setInlineValue(false)
          )
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(false),
        z: new BlueNode()
          .setType(
            new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID).setInlineValue(false)
          )
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(false),
        v: new BlueNode()
          .setType(
            new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID).setInlineValue(false)
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
            new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID).setInlineValue(false)
          )
          .setValue(new BigIntegerNumber('1'))
          .setInlineValue(false),
      })
      .setInlineValue(false);

    assertNodesEqual(expectedRaw, rawNode);
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
          Object.keys(expectedProps).length
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
