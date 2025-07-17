import { describe, it, expect } from 'vitest';
import { BlueNode, NodeDeserializer } from '../../model';
import { InMemoryNodeProvider } from '../../provider/InMemoryNodeProvider';
import { Merger } from '../Merger';
import { MergingProcessor } from '../MergingProcessor';
import { SequentialMergingProcessor } from '../processors/SequentialMergingProcessor';
import { ListProcessor } from '../processors/ListProcessor';
import { TypeAssigner } from '../processors/TypeAssigner';
import { NodeExtender } from '../../utils/NodeExtender';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { NO_LIMITS } from '../../utils/limits';
import {
  LIST_TYPE_BLUE_ID,
  CORE_TYPE_BLUE_ID_TO_NAME_MAP,
  INTEGER_TYPE_BLUE_ID,
} from '../../utils/Properties';

describe('ListProcessor', () => {
  // Helper function to create a node provider with core types
  function createNodeProviderWithCoreTypes(): InMemoryNodeProvider {
    const provider = new InMemoryNodeProvider();

    // Add List type
    const listType = new BlueNode()
      .setName('List')
      .setBlueId(LIST_TYPE_BLUE_ID);
    provider.addNodeWithBlueId(LIST_TYPE_BLUE_ID, listType);

    // Add Integer type
    const integerType = new BlueNode()
      .setName('Integer')
      .setBlueId(INTEGER_TYPE_BLUE_ID);
    provider.addNodeWithBlueId(INTEGER_TYPE_BLUE_ID, integerType);

    return provider;
  }

  it('testItemTypeAssignment', () => {
    const nodeProvider = createNodeProviderWithCoreTypes();

    const listA = new BlueNode()
      .setName('ListA')
      .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
      .setItemType(new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID));
    nodeProvider.addSingleNodes(listA);

    const listABlueId = BlueIdCalculator.calculateBlueIdSync(listA);
    const listB = new BlueNode()
      .setName('ListB')
      .setType(new BlueNode().setBlueId(listABlueId));
    nodeProvider.addSingleNodes(listB);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const listBBlueId = BlueIdCalculator.calculateBlueIdSync(listB);
    const listBNode = nodeProvider.fetchByBlueId(listBBlueId)[0];
    new NodeExtender(nodeProvider).extend(listBNode, NO_LIMITS);
    const result = merger.resolve(listBNode, NO_LIMITS);

    expect(result.getItemType()?.getBlueId()).toBeDefined();
    expect(
      CORE_TYPE_BLUE_ID_TO_NAME_MAP[
        result
          .getItemType()!
          .getBlueId() as keyof typeof CORE_TYPE_BLUE_ID_TO_NAME_MAP
      ]
    ).toBe('Integer');
  });

  it('testListWithValidItemTypes', () => {
    const nodeProvider = createNodeProviderWithCoreTypes();

    // Create node A
    const a = 'name: A';
    const parsedA = yamlBlueParse(a);
    const nodeA = NodeDeserializer.deserialize(parsedA!);
    nodeProvider.addSingleNodes(nodeA);
    const blueIdA = BlueIdCalculator.calculateBlueIdSync(nodeA);

    // Create node B
    const b = `name: B
type:
  blueId: ${blueIdA}`;
    const parsedB = yamlBlueParse(b);
    const nodeB = NodeDeserializer.deserialize(parsedB!);
    nodeProvider.addSingleNodes(nodeB);
    const blueIdB = BlueIdCalculator.calculateBlueIdSync(nodeB);

    // Create node C
    const c = `name: C
type:
  blueId: ${blueIdB}`;
    const parsedC = yamlBlueParse(c);
    const nodeC = NodeDeserializer.deserialize(parsedC!);
    nodeProvider.addSingleNodes(nodeC);
    const blueIdC = BlueIdCalculator.calculateBlueIdSync(nodeC);

    // Create ListOfB
    const listOfB = `name: ListOfB
type:
  blueId: ${LIST_TYPE_BLUE_ID}
itemType:
  blueId: ${blueIdB}
items:
  - type:
      blueId: ${blueIdB}
  - type:
      blueId: ${blueIdC}`;
    const parsedListOfB = yamlBlueParse(listOfB);
    const nodeListOfB = NodeDeserializer.deserialize(parsedListOfB!);
    nodeProvider.addSingleNodes(nodeListOfB);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const listOfBBlueId = BlueIdCalculator.calculateBlueIdSync(nodeListOfB);
    const listOfBNode = nodeProvider.fetchByBlueId(listOfBBlueId)[0];
    new NodeExtender(nodeProvider).extend(listOfBNode, NO_LIMITS);
    const result = merger.resolve(listOfBNode, NO_LIMITS);

    expect(result.getItemType()?.getName()).toBe('B');
    expect(result.getItems()?.length).toBe(2);
    expect(result.getItems()?.[0].getType()?.getName()).toBe('B');
    expect(result.getItems()?.[1].getType()?.getName()).toBe('C');
  });

  it('testListWithInvalidItemType', () => {
    const nodeProvider = createNodeProviderWithCoreTypes();

    // Create node A
    const a = 'name: A';
    const parsedA = yamlBlueParse(a);
    const nodeA = NodeDeserializer.deserialize(parsedA!);
    nodeProvider.addSingleNodes(nodeA);
    const blueIdA = BlueIdCalculator.calculateBlueIdSync(nodeA);

    // Create node B
    const b = `name: B
type: ${blueIdA}`;
    const parsedB = yamlBlueParse(b);
    const nodeB = NodeDeserializer.deserialize(parsedB!);
    nodeProvider.addSingleNodes(nodeB);
    const blueIdB = BlueIdCalculator.calculateBlueIdSync(nodeB);

    // Create ListOfB with invalid item type
    const listOfB = `name: ListOfB
type: List
itemType: ${blueIdB}
items:
  - type: ${blueIdB}
  - type: ${blueIdA}`; // This should cause an error
    const parsedListOfB = yamlBlueParse(listOfB);
    const nodeListOfB = NodeDeserializer.deserialize(parsedListOfB!);
    nodeProvider.addSingleNodes(nodeListOfB);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const listOfBBlueId = BlueIdCalculator.calculateBlueIdSync(nodeListOfB);
    const listOfBNode = nodeProvider.fetchByBlueId(listOfBBlueId)[0];
    new NodeExtender(nodeProvider).extend(listOfBNode, NO_LIMITS);

    expect(() => merger.resolve(listOfBNode, NO_LIMITS)).toThrow();
  });

  it('testInheritedList', () => {
    const nodeProvider = createNodeProviderWithCoreTypes();

    // Create node A
    const a = 'name: A';
    const parsedA = yamlBlueParse(a);
    const nodeA = NodeDeserializer.deserialize(parsedA!);
    nodeProvider.addSingleNodes(nodeA);
    const blueIdA = BlueIdCalculator.calculateBlueIdSync(nodeA);

    // Create node B
    const b = `name: B
type:
  blueId: ${blueIdA}`;
    const parsedB = yamlBlueParse(b);
    const nodeB = NodeDeserializer.deserialize(parsedB!);
    nodeProvider.addSingleNodes(nodeB);
    const blueIdB = BlueIdCalculator.calculateBlueIdSync(nodeB);

    // Create node C
    const c = `name: C
type:
  blueId: ${blueIdB}`;
    const parsedC = yamlBlueParse(c);
    const nodeC = NodeDeserializer.deserialize(parsedC!);
    nodeProvider.addSingleNodes(nodeC);
    const blueIdC = BlueIdCalculator.calculateBlueIdSync(nodeC);

    // Create ListOfB
    const listOfB = `name: ListOfB
type:
  blueId: ${LIST_TYPE_BLUE_ID}
itemType:
  blueId: ${blueIdB}`;
    const parsedListOfB = yamlBlueParse(listOfB);
    const nodeListOfB = NodeDeserializer.deserialize(parsedListOfB!);
    nodeProvider.addSingleNodes(nodeListOfB);
    const blueIdListOfB = BlueIdCalculator.calculateBlueIdSync(nodeListOfB);

    // Create InheritedList
    const inheritedList = `name: InheritedList
type:
  blueId: ${blueIdListOfB}
items:
  - type:
      blueId: ${blueIdB}
  - type:
      blueId: ${blueIdC}`;
    const parsedInheritedList = yamlBlueParse(inheritedList);
    const nodeInheritedList = NodeDeserializer.deserialize(
      parsedInheritedList!
    );
    nodeProvider.addSingleNodes(nodeInheritedList);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const inheritedListBlueId =
      BlueIdCalculator.calculateBlueIdSync(nodeInheritedList);
    const inheritedListNode =
      nodeProvider.fetchByBlueId(inheritedListBlueId)[0];
    new NodeExtender(nodeProvider).extend(inheritedListNode, NO_LIMITS);
    const result = merger.resolve(inheritedListNode, NO_LIMITS);

    expect(result.getItemType()?.getName()).toBe('B');
    expect(result.getItems()?.length).toBe(2);
    expect(result.getItems()?.[0].getType()?.getName()).toBe('B');
    expect(result.getItems()?.[1].getType()?.getName()).toBe('C');
  });

  it('testInheritedListWithInvalidItemType', () => {
    const nodeProvider = createNodeProviderWithCoreTypes();

    // Create node A
    const a = 'name: A';
    const parsedA = yamlBlueParse(a);
    const nodeA = NodeDeserializer.deserialize(parsedA!);
    nodeProvider.addSingleNodes(nodeA);
    const blueIdA = BlueIdCalculator.calculateBlueIdSync(nodeA);

    // Create node B
    const b = `name: B
type:
  blueId: ${blueIdA}`;
    const parsedB = yamlBlueParse(b);
    const nodeB = NodeDeserializer.deserialize(parsedB!);
    nodeProvider.addSingleNodes(nodeB);
    const blueIdB = BlueIdCalculator.calculateBlueIdSync(nodeB);

    // Create ListOfB
    const listOfB = `name: ListOfB
type:
  blueId: ${LIST_TYPE_BLUE_ID}
itemType:
  blueId: ${blueIdB}`;
    const parsedListOfB = yamlBlueParse(listOfB);
    const nodeListOfB = NodeDeserializer.deserialize(parsedListOfB!);
    nodeProvider.addSingleNodes(nodeListOfB);
    const blueIdListOfB = BlueIdCalculator.calculateBlueIdSync(nodeListOfB);

    // Create InheritedList with invalid item type
    const inheritedList = `name: InheritedList
type:
  blueId: ${blueIdListOfB}
items:
  - type:
      blueId: ${blueIdB}
  - type:
      blueId: ${blueIdA}`; // This should cause an error
    const parsedInheritedList = yamlBlueParse(inheritedList);
    const nodeInheritedList = NodeDeserializer.deserialize(
      parsedInheritedList!
    );
    nodeProvider.addSingleNodes(nodeInheritedList);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const inheritedListBlueId =
      BlueIdCalculator.calculateBlueIdSync(nodeInheritedList);
    const inheritedListNode =
      nodeProvider.fetchByBlueId(inheritedListBlueId)[0];
    new NodeExtender(nodeProvider).extend(inheritedListNode, NO_LIMITS);

    expect(() => merger.resolve(inheritedListNode, NO_LIMITS)).toThrow();
  });

  it('testListWithNoItemType', () => {
    const nodeProvider = createNodeProviderWithCoreTypes();

    // Create node A
    const a = 'name: A';
    const parsedA = yamlBlueParse(a);
    const nodeA = NodeDeserializer.deserialize(parsedA!);
    nodeProvider.addSingleNodes(nodeA);
    const blueIdA = BlueIdCalculator.calculateBlueIdSync(nodeA);

    // Create list with no itemType
    const listWithNoItemType = `name: ListWithNoItemType
type:
  blueId: ${LIST_TYPE_BLUE_ID}
items:
  - type:
      blueId: ${blueIdA}`;
    const parsedList = yamlBlueParse(listWithNoItemType);
    const nodeList = NodeDeserializer.deserialize(parsedList!);
    nodeProvider.addSingleNodes(nodeList);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const listBlueId = BlueIdCalculator.calculateBlueIdSync(nodeList);
    const listNode = nodeProvider.fetchByBlueId(listBlueId)[0];
    new NodeExtender(nodeProvider).extend(listNode, NO_LIMITS);
    const result = merger.resolve(listNode, NO_LIMITS);

    expect(result.getItemType()).toBeUndefined();
    expect(result.getItems()?.length).toBe(1);
    expect(result.getItems()?.[0].getType()?.getName()).toBe('A');
  });

  it('testNonListTypeWithItemType', () => {
    const nodeProvider = createNodeProviderWithCoreTypes();

    // Create node A
    const a = 'name: A';
    const parsedA = yamlBlueParse(a);
    const nodeA = NodeDeserializer.deserialize(parsedA!);
    nodeProvider.addSingleNodes(nodeA);
    const blueIdA = BlueIdCalculator.calculateBlueIdSync(nodeA);

    // Create non-list with itemType
    const nonListWithItemType = `name: NonListWithItemType
type: ${blueIdA}
itemType: ${blueIdA}`;
    const parsedNonList = yamlBlueParse(nonListWithItemType);
    const nodeNonList = NodeDeserializer.deserialize(parsedNonList!);
    nodeProvider.addSingleNodes(nodeNonList);

    const mergingProcessor: MergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
      new ListProcessor(),
    ]);

    const merger = new Merger(mergingProcessor, nodeProvider);
    const nonListBlueId = BlueIdCalculator.calculateBlueIdSync(nodeNonList);
    const nonListNode = nodeProvider.fetchByBlueId(nonListBlueId)[0];
    new NodeExtender(nodeProvider).extend(nonListNode, NO_LIMITS);

    expect(() => merger.resolve(nonListNode, NO_LIMITS)).toThrow();
  });
});
