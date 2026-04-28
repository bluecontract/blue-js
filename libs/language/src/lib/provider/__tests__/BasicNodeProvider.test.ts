import { describe, it, expect } from 'vitest';
import { BasicNodeProvider } from '../BasicNodeProvider';
import { BlueNode, NodeDeserializer } from '../../model';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { Blue } from '../../Blue';
import { InMemoryNodeProvider } from '../InMemoryNodeProvider';
import { BlueErrorCode } from '../../errors/BlueError';

describe('BasicNodeProvider', () => {
  it('should handle single nodes', () => {
    const node = new BlueNode('TestNode')
      .setValue('test value')
      .setDescription('A test node');

    const provider = new BasicNodeProvider([node]);

    // Test fetching by name
    const foundNode = provider.findNodeByName('TestNode');
    expect(foundNode).toBeDefined();
    expect(foundNode?.getName()).toBe('TestNode');
    expect(foundNode?.getValue()).toBe('test value');
    expect(foundNode?.getDescription()).toBe('A test node');
  });

  it('should handle multiple nodes with same name', () => {
    const node1 = new BlueNode('DuplicateName').setValue('value1');
    const node2 = new BlueNode('DuplicateName').setValue('value2');

    const provider = new BasicNodeProvider([node1, node2]);

    // Should throw when finding single node by name
    expect(() => provider.findNodeByName('DuplicateName')).toThrow(
      'Multiple nodes found with name: DuplicateName',
    );

    // But should return all when finding all by name
    const allNodes = provider.findAllNodesByName('DuplicateName');
    expect(allNodes).toHaveLength(2);
  });

  it('should handle YAML documents', () => {
    const yaml = `
name: YamlNode
value: yaml value
type: Text`;

    const provider = new BasicNodeProvider();
    provider.addSingleDocs(yaml);

    const node = provider.getNodeByName('YamlNode');
    expect(node).toBeDefined();
    expect(node.getValue()).toBe('yaml value');
  });

  it('should handle nodes with items', () => {
    const items = [
      new BlueNode('Item1').setValue('value1'),
      new BlueNode('Item2').setValue('value2'),
    ];

    const listNode = new BlueNode().setItems(items);

    const provider = new BasicNodeProvider([listNode]);
    const blue = new Blue({ nodeProvider: provider });

    // Items should be accessible by their name with #index
    const listBlueId = blue.calculateBlueIdSync(
      items.map((item) => blue.preprocess(item)),
    );
    const foundItems = provider.fetchByBlueId(listBlueId);
    expect(foundItems).toHaveLength(2);

    // Should be able to find individual items
    const item1 = provider.fetchByBlueId(`${listBlueId}#0`);
    expect(item1).toHaveLength(1);
    expect(item1?.[0].getValue()).toBe('value1');
  });

  it('should handle list and its items', () => {
    const items = [
      new BlueNode('ListItem1').setValue('item1'),
      new BlueNode('ListItem2').setValue('item2'),
    ];

    const provider = new BasicNodeProvider();
    provider.addListAndItsItems(items);

    // Should be able to find individual items by name
    const item1 = provider.findNodeByName('ListItem1');
    expect(item1?.getValue()).toBe('item1');

    const item2 = provider.findNodeByName('ListItem2');
    expect(item2?.getValue()).toBe('item2');
  });

  it('maps cyclic list item names when adding list and its items', () => {
    const listNode = NodeDeserializer.deserialize(
      yamlBlueParse(`- name: ListCycleA
  peer:
    blueId: this#1
- name: ListCycleB
  peer:
    blueId: this#0
`),
    );
    const items = listNode.getItems() ?? [];
    const provider = new BasicNodeProvider();

    provider.addListAndItsItems(items);

    const aBlueId = provider.getBlueIdByName('ListCycleA');
    const bBlueId = provider.getBlueIdByName('ListCycleB');
    expect(aBlueId).toMatch(/#\d+$/);
    expect(bBlueId).toMatch(/#\d+$/);
    expect(provider.getNodeByName('ListCycleA').get('/peer/blueId')).toBe(
      bBlueId,
    );
    expect(provider.getNodeByName('ListCycleB').get('/peer/blueId')).toBe(
      aBlueId,
    );
  });

  it('should fetch by Blue ID', () => {
    const node = new BlueNode('TestBlueId').setValue('test');
    const provider = new BasicNodeProvider([node]);
    const blue = new Blue({ nodeProvider: provider });

    const blueId = blue.calculateBlueIdSync(blue.preprocess(node));
    const fetched = provider.fetchByBlueId(blueId);

    expect(fetched).toHaveLength(1);
    expect(fetched?.[0].getName()).toBe('TestBlueId');
    expect(fetched?.[0].getValue()).toBe('test');
  });

  it('keeps scalar this strings as ordinary content', () => {
    const yaml = `
name: SelfReference
value: this`;

    const parsed = yamlBlueParse(yaml);
    const node = NodeDeserializer.deserialize(parsed!);

    const provider = new BasicNodeProvider([node]);
    const blueId = provider.getBlueIdByName('SelfReference');
    const fetched = provider.fetchByBlueId(blueId);

    expect(fetched).toHaveLength(1);
    expect(fetched?.[0].getValue()).toBe('this');
    expect(fetched?.[0].getValue()).not.toBe(blueId);
  });

  it('keeps scalar this#k strings, list strings, and ordinary fields unchanged', () => {
    const provider = new BasicNodeProvider();

    provider.addSingleDocs(`
name: OrdinaryThisStrings
note: this
tag: this#1
tags:
  items:
    - this
    - this#1
`);

    const fetched = provider.getNodeByName('OrdinaryThisStrings');

    expect(fetched.get('/note/value')).toBe('this');
    expect(fetched.get('/tag/value')).toBe('this#1');
    expect(fetched.get('/tags/0/value')).toBe('this');
    expect(fetched.get('/tags/1/value')).toBe('this#1');
  });

  it('rejects this references in blueId fields until phase 3', () => {
    const provider = new BasicNodeProvider();

    expect(() =>
      provider.addSingleDocs(`
name: SelfReference
self:
  blueId: this
`),
    ).toThrow(/Self-references using this or this#k are not supported/);
  });

  it('rejects indexed this references in single-document ingest', () => {
    const provider = new BasicNodeProvider();

    expect(() =>
      provider.addSingleDocs(`
name: InvalidSingleThisReference
self:
  blueId: this#1
`),
    ).toThrow(/Self-references using this or this#k are not supported/);
  });

  it('should throw error for non-existent node', () => {
    const provider = new BasicNodeProvider();

    expect(() => provider.getNodeByName('NonExistent')).toThrow(
      'No node with name "NonExistent"',
    );

    expect(() => provider.getBlueIdByName('NonExistent')).toThrow(
      'No node with name "NonExistent"',
    );
  });

  it('rejects content whose semantic storage resolve fails', () => {
    const provider = new BasicNodeProvider();

    expect(() =>
      provider.addSingleDocs(`
name: InvalidTypedNode
type:
  blueId: MissingTypeBlueId
`),
    ).toThrow(/MissingTypeBlueId/);
  });

  it('rejects root blueId plus payload during ingest', () => {
    const provider = new BasicNodeProvider();

    expect(() =>
      provider.addSingleDocs(`
blueId: ExistingReferenceBlueId
name: AmbiguousRoot
`),
    ).toThrow(/Ambiguous blueId plus payload at \//);
  });
});

describe('InMemoryNodeProvider', () => {
  it('rejects provided BlueIds that do not match semantic storage identity', () => {
    const provider = new InMemoryNodeProvider();

    expect(() =>
      provider.addNodeWithBlueId('WrongBlueId', new BlueNode('MemoryNode')),
    ).toThrow(
      expect.objectContaining({ code: BlueErrorCode.BLUE_ID_MISMATCH }),
    );
  });

  it('fetches direct cyclic document set members by MASTER suffix', () => {
    const provider = new InMemoryNodeProvider();
    const list = NodeDeserializer.deserialize(
      yamlBlueParse(`- name: MemoryA
  peer:
    blueId: this#1
- name: MemoryB
  peer:
    blueId: this#0
`),
    ).getItems();

    provider.addList(list ?? []);
    const blue = new Blue();
    const masterBlueId = blue.calculateBlueIdSync(list ?? []);
    const fetchedSet = provider.fetchByBlueId(masterBlueId);

    expect(fetchedSet).toHaveLength(2);
    const fetchedA = fetchedSet.find((node) => node.getName() === 'MemoryA');
    const fetchedB = fetchedSet.find((node) => node.getName() === 'MemoryB');
    expect(fetchedA?.get('/peer/blueId')).toBe(
      `${masterBlueId}#${fetchedSet.findIndex(
        (node) => node.getName() === 'MemoryB',
      )}`,
    );
    expect(fetchedB?.get('/peer/blueId')).toBe(
      `${masterBlueId}#${fetchedSet.findIndex(
        (node) => node.getName() === 'MemoryA',
      )}`,
    );
  });
});
