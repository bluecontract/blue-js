import { describe, it, expect } from 'vitest';
import { BlueNode } from '../../model';
import { Merger } from '../Merger';
import { MergingProcessor } from '../MergingProcessor';
import { SequentialMergingProcessor } from '../processors/SequentialMergingProcessor';
import { DictionaryProcessor } from '../processors/DictionaryProcessor';
import { TypeAssigner } from '../processors/TypeAssigner';
import { NodeExtender } from '../../utils/NodeExtender';
import { NO_LIMITS } from '../../utils/limits';
import {
  DICTIONARY_TYPE,
  TEXT_TYPE,
  CORE_TYPE_BLUE_ID_TO_NAME_MAP,
} from '../../utils/Properties';
import { BasicNodeProvider } from '../../provider/BasicNodeProvider';

describe('DictionaryProcessor', () => {
  it('testKeyTypeAndValueTypeAssignment', () => {
    const dictA = new BlueNode()
      .setName('DictA')
      .setType('Dictionary')
      .setKeyType('Text')
      .setValueType('Integer');

    const nodeProvider = new BasicNodeProvider();
    nodeProvider.addSingleNodes(dictA);

    const dictB = new BlueNode()
      .setName('DictB')
      .setType(new BlueNode().setBlueId(nodeProvider.getBlueIdByName('DictA')));

    nodeProvider.addSingleNodes(dictB);
    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new DictionaryProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const dictANode = nodeProvider.findNodeByName('DictA');
    if (!dictANode) {
      throw new Error('DictA not found');
    }
    const result = merger.resolve(dictANode, NO_LIMITS);

    expect(result.getKeyType()?.getBlueId()).toBeDefined();
    expect(result.getValueType()?.getBlueId()).toBeDefined();
    expect(
      CORE_TYPE_BLUE_ID_TO_NAME_MAP[
        result
          .getKeyType()!
          .getBlueId() as keyof typeof CORE_TYPE_BLUE_ID_TO_NAME_MAP
      ]
    ).toBe('Text');
    expect(
      CORE_TYPE_BLUE_ID_TO_NAME_MAP[
        result
          .getValueType()!
          .getBlueId() as keyof typeof CORE_TYPE_BLUE_ID_TO_NAME_MAP
      ]
    ).toBe('Integer');
  });

  it('testDictionaryWithValidTypes', () => {
    const nodeProvider = new BasicNodeProvider();

    const a = 'name: A';
    nodeProvider.addSingleDocs(a);

    const b = `name: B
type:
  blueId: ${nodeProvider.getBlueIdByName('A')}`;
    nodeProvider.addSingleDocs(b);

    const dictOfAToB = `name: DictOfAToB
type: Dictionary
keyType: ${TEXT_TYPE}
valueType:
  blueId: ${nodeProvider.getBlueIdByName('A')}
key1:
  type:
    blueId: ${nodeProvider.getBlueIdByName('A')}
key2:
  type:
    blueId: ${nodeProvider.getBlueIdByName('B')}`;
    nodeProvider.addSingleDocs(dictOfAToB);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new DictionaryProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const dictOfAToBNode = nodeProvider.findNodeByName('DictOfAToB');
    if (!dictOfAToBNode) {
      throw new Error('DictOfAToB not found');
    }
    new NodeExtender(nodeProvider).extend(dictOfAToBNode, NO_LIMITS);
    const result = merger.resolve(dictOfAToBNode, NO_LIMITS);

    expect(result.getKeyType()?.getBlueId()).toBeDefined();
    expect(
      CORE_TYPE_BLUE_ID_TO_NAME_MAP[
        result
          .getKeyType()!
          .getBlueId() as keyof typeof CORE_TYPE_BLUE_ID_TO_NAME_MAP
      ]
    ).toBe('Text');
    expect(result.getValueType()?.getName()).toBe('A');
    expect(Object.keys(result.getProperties() || {}).length).toBe(2);
    expect(result.getProperties()?.['key1']?.getType()?.getName()).toBe('A');
    expect(result.getProperties()?.['key2']?.getType()?.getName()).toBe('B');
  });

  it('testDictionaryWithInvalidKeyType', () => {
    const nodeProvider = new BasicNodeProvider();

    const dictWithInvalidKeyType = `name: DictWithInvalidKeyType
type: Dictionary
keyType: ${DICTIONARY_TYPE}
valueType: ${TEXT_TYPE}`;
    nodeProvider.addSingleDocs(dictWithInvalidKeyType);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new DictionaryProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const dictNode = nodeProvider.findNodeByName('DictWithInvalidKeyType');
    if (!dictNode) {
      throw new Error('DictWithInvalidKeyType not found');
    }
    new NodeExtender(nodeProvider).extend(dictNode, NO_LIMITS);

    expect(() => merger.resolve(dictNode, NO_LIMITS)).toThrow();
  });

  it('testDictionaryWithInvalidValueType', () => {
    const nodeProvider = new BasicNodeProvider();

    const a = 'name: A';
    nodeProvider.addSingleDocs(a);

    const dictWithInvalidValue = `name: DictWithInvalidValue
type: Dictionary
keyType: ${TEXT_TYPE}
valueType:
  blueId: ${nodeProvider.getBlueIdByName('A')}
key1:
  type: ${TEXT_TYPE}`; // This should cause an error
    nodeProvider.addSingleDocs(dictWithInvalidValue);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new DictionaryProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const dictNode = nodeProvider.findNodeByName('DictWithInvalidValue');
    if (!dictNode) {
      throw new Error('DictWithInvalidValue not found');
    }
    new NodeExtender(nodeProvider).extend(dictNode, NO_LIMITS);

    expect(() => merger.resolve(dictNode, NO_LIMITS)).toThrow();
  });

  it('testNonDictionaryTypeWithKeyTypeOrValueType', () => {
    const nodeProvider = new BasicNodeProvider();

    const nonDictWithKeyType = `name: NonDictWithKeyType
type: ${TEXT_TYPE}
keyType: ${TEXT_TYPE}`;
    nodeProvider.addSingleDocs(nonDictWithKeyType);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new DictionaryProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const nonDictNode = nodeProvider.findNodeByName('NonDictWithKeyType');
    if (!nonDictNode) {
      throw new Error('NonDictWithKeyType not found');
    }
    new NodeExtender(nodeProvider).extend(nonDictNode, NO_LIMITS);

    expect(() => merger.resolve(nonDictNode, NO_LIMITS)).toThrow();
  });
});
