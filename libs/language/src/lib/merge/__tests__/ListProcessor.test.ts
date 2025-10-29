import { describe, it, expect } from 'vitest';
import { BlueNode } from '../../model';
import { Merger } from '../Merger';
import { MergingProcessor } from '../MergingProcessor';
import { SequentialMergingProcessor } from '../processors/SequentialMergingProcessor';
import { ListProcessor } from '../processors/ListProcessor';
import { TypeAssigner } from '../processors/TypeAssigner';
import { NodeExtender } from '../../utils/NodeExtender';
import { NO_LIMITS } from '../../utils/limits';
import {
  LIST_TYPE_BLUE_ID,
  CORE_TYPE_BLUE_ID_TO_NAME_MAP,
} from '../../utils/Properties';
import { BasicNodeProvider } from '../../provider/BasicNodeProvider';

describe('ListProcessor', () => {
  it('testItemTypeAssignment', () => {
    const nodeProvider = new BasicNodeProvider();

    const listA = new BlueNode()
      .setName('ListA')
      .setType('List')
      .setItemType('Integer');
    nodeProvider.addSingleNodes(listA);

    const listB = new BlueNode()
      .setName('ListB')
      .setType(new BlueNode().setBlueId(nodeProvider.getBlueIdByName('ListA')));
    nodeProvider.addSingleNodes(listB);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);

    const listBNode = nodeProvider.findNodeByName('ListB');
    if (!listBNode) {
      throw new Error('ListB not found');
    }

    const result = merger.resolve(listBNode, NO_LIMITS);

    expect(result.getItemType()?.getBlueId()).toBeDefined();
    expect(
      CORE_TYPE_BLUE_ID_TO_NAME_MAP[
        result
          .getItemType()!
          .getBlueId() as keyof typeof CORE_TYPE_BLUE_ID_TO_NAME_MAP
      ],
    ).toBe('Integer');
  });

  it('testListWithValidItemTypes', () => {
    const nodeProvider = new BasicNodeProvider();

    // Create node A
    const a = 'name: A';
    nodeProvider.addSingleDocs(a);

    // Create node B
    const b = `name: B
type:
  blueId: ${nodeProvider.getBlueIdByName('A')}`;
    nodeProvider.addSingleDocs(b);

    // Create node C
    const c = `name: C
type:
  blueId: ${nodeProvider.getBlueIdByName('B')}`;
    nodeProvider.addSingleDocs(c);

    // Create ListOfB
    const listOfB = `name: ListOfB
type:
  blueId: ${LIST_TYPE_BLUE_ID}
itemType:
  blueId: ${nodeProvider.getBlueIdByName('B')}
items:
  - type:
      blueId: ${nodeProvider.getBlueIdByName('B')}
  - type:
      blueId: ${nodeProvider.getBlueIdByName('C')}`;
    nodeProvider.addSingleDocs(listOfB);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const listOfBNode = nodeProvider.findNodeByName('ListOfB');
    if (!listOfBNode) {
      throw new Error('ListOfB not found');
    }
    new NodeExtender(nodeProvider).extend(listOfBNode, NO_LIMITS);
    const result = merger.resolve(listOfBNode, NO_LIMITS);

    expect(result.getItemType()?.getName()).toBe('B');
    expect(result.getItems()?.length).toBe(2);
    expect(result.getItems()?.[0].getType()?.getName()).toBe('B');
    expect(result.getItems()?.[1].getType()?.getName()).toBe('C');
  });

  it('testListWithInvalidItemType', () => {
    const nodeProvider = new BasicNodeProvider();

    // Create node A
    const a = 'name: A';
    nodeProvider.addSingleDocs(a);

    // Create node B
    const b = `name: B
type:
  blueId: ${nodeProvider.getBlueIdByName('A')}`;
    nodeProvider.addSingleDocs(b);

    // Create ListOfB with invalid item type
    const listOfB = `name: ListOfB
type: List
itemType:
  blueId: ${nodeProvider.getBlueIdByName('B')}
items:
  - type:
      blueId: ${nodeProvider.getBlueIdByName('B')}
  - type:
      blueId: ${nodeProvider.getBlueIdByName('A')}`; // This should cause an error
    nodeProvider.addSingleDocs(listOfB);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const listOfBNode = nodeProvider.findNodeByName('ListOfB');
    if (!listOfBNode) {
      throw new Error('ListOfB not found');
    }
    new NodeExtender(nodeProvider).extend(listOfBNode, NO_LIMITS);

    expect(() => merger.resolve(listOfBNode, NO_LIMITS)).toThrow();
  });

  it('testInheritedList', () => {
    const nodeProvider = new BasicNodeProvider();

    // Create node A
    const a = 'name: A';
    nodeProvider.addSingleDocs(a);

    // Create node B
    const b = `name: B
type:
  blueId: ${nodeProvider.getBlueIdByName('A')}`;
    nodeProvider.addSingleDocs(b);

    // Create node C
    const c = `name: C
type:
  blueId: ${nodeProvider.getBlueIdByName('B')}`;
    nodeProvider.addSingleDocs(c);

    // Create ListOfB
    const listOfB = `name: ListOfB
type:
  blueId: ${LIST_TYPE_BLUE_ID}
itemType:
  blueId: ${nodeProvider.getBlueIdByName('B')}`;
    nodeProvider.addSingleDocs(listOfB);

    // Create InheritedList
    const inheritedList = `name: InheritedList
type:
  blueId: ${nodeProvider.getBlueIdByName('ListOfB')}
items:
  - type:
      blueId: ${nodeProvider.getBlueIdByName('B')}
  - type:
      blueId: ${nodeProvider.getBlueIdByName('C')}`;
    nodeProvider.addSingleDocs(inheritedList);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const inheritedListNode = nodeProvider.findNodeByName('InheritedList');
    if (!inheritedListNode) {
      throw new Error('InheritedList not found');
    }
    new NodeExtender(nodeProvider).extend(inheritedListNode, NO_LIMITS);
    const result = merger.resolve(inheritedListNode, NO_LIMITS);

    expect(result.getItemType()?.getName()).toBe('B');
    expect(result.getItems()?.length).toBe(2);
    expect(result.getItems()?.[0].getType()?.getName()).toBe('B');
    expect(result.getItems()?.[1].getType()?.getName()).toBe('C');
  });

  it('testInheritedListWithInvalidItemType', () => {
    const nodeProvider = new BasicNodeProvider();

    // Create node A
    const a = 'name: A';
    nodeProvider.addSingleDocs(a);

    // Create node B
    const b = `name: B
type:
  blueId: ${nodeProvider.getBlueIdByName('A')}`;
    nodeProvider.addSingleDocs(b);

    // Create ListOfB
    const listOfB = `name: ListOfB
type:
  blueId: ${LIST_TYPE_BLUE_ID}
itemType:
  blueId: ${nodeProvider.getBlueIdByName('B')}`;
    nodeProvider.addSingleDocs(listOfB);

    // Create InheritedList with invalid item type
    const inheritedList = `name: InheritedList
type:
  blueId: ${nodeProvider.getBlueIdByName('ListOfB')}
items:
  - type:
      blueId: ${nodeProvider.getBlueIdByName('B')}
  - type:
      blueId: ${nodeProvider.getBlueIdByName('A')}`; // This should cause an error
    nodeProvider.addSingleDocs(inheritedList);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const inheritedListNode = nodeProvider.findNodeByName('InheritedList');
    if (!inheritedListNode) {
      throw new Error('InheritedList not found');
    }
    new NodeExtender(nodeProvider).extend(inheritedListNode, NO_LIMITS);

    expect(() => merger.resolve(inheritedListNode, NO_LIMITS)).toThrow();
  });

  it('testListWithNoItemType', () => {
    const nodeProvider = new BasicNodeProvider();

    // Create node A
    const a = 'name: A';
    nodeProvider.addSingleDocs(a);

    // Create list with no itemType
    const listWithNoItemType = `name: ListWithNoItemType
type:
  blueId: ${LIST_TYPE_BLUE_ID}
items:
  - type:
      blueId: ${nodeProvider.getBlueIdByName('A')}`;
    nodeProvider.addSingleDocs(listWithNoItemType);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const listNode = nodeProvider.findNodeByName('ListWithNoItemType');
    if (!listNode) {
      throw new Error('ListWithNoItemType not found');
    }
    new NodeExtender(nodeProvider).extend(listNode, NO_LIMITS);
    const result = merger.resolve(listNode, NO_LIMITS);

    expect(result.getItemType()).toBeUndefined();
    expect(result.getItems()?.length).toBe(1);
    expect(result.getItems()?.[0].getType()?.getName()).toBe('A');
  });

  it('testNonListTypeWithItemType', () => {
    const nodeProvider = new BasicNodeProvider();

    // Create node A
    const a = 'name: A';
    nodeProvider.addSingleDocs(a);

    // Create non-list with itemType
    const nonListWithItemType = `name: NonListWithItemType
type:
  blueId: ${nodeProvider.getBlueIdByName('A')}
itemType:
  blueId: ${nodeProvider.getBlueIdByName('A')}`;

    nodeProvider.addSingleDocs(nonListWithItemType);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const nonListNode = nodeProvider.findNodeByName('NonListWithItemType');
    if (!nonListNode) {
      throw new Error('NonListWithItemType not found');
    }
    new NodeExtender(nodeProvider).extend(nonListNode, NO_LIMITS);

    expect(() => merger.resolve(nonListNode, NO_LIMITS)).toThrow();
  });
});
