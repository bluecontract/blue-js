import { describe, it, expect } from 'vitest';
import { BasicNodeProvider } from '../BasicNodeProvider';
import { BlueNode, NodeDeserializer } from '../../model';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { BlueIdCalculator } from '../../utils';

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
      'Multiple nodes found with name: DuplicateName'
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

    // Items should be accessible by their name with #index
    const listBlueId = BlueIdCalculator.calculateBlueIdSync(items);
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

  it('should fetch by Blue ID', () => {
    const node = new BlueNode('TestBlueId').setValue('test');
    const provider = new BasicNodeProvider([node]);

    const blueId = BlueIdCalculator.calculateBlueIdSync(node);
    const fetched = provider.fetchByBlueId(blueId);

    expect(fetched).toHaveLength(1);
    expect(fetched?.[0].getName()).toBe('TestBlueId');
    expect(fetched?.[0].getValue()).toBe('test');
  });

  it('should resolve this references', () => {
    const yaml = `
name: SelfReference
value: this`;

    const parsed = yamlBlueParse(yaml);
    const node = NodeDeserializer.deserialize(parsed!);

    const provider = new BasicNodeProvider([node]);
    const blueId = provider.getBlueIdByName('SelfReference');
    const fetched = provider.fetchByBlueId(blueId);

    expect(fetched).toHaveLength(1);
    // The 'this' reference should be resolved to the Blue ID
    expect(fetched?.[0].getValue()).toBe(blueId);
  });

  it('should throw error for non-existent node', () => {
    const provider = new BasicNodeProvider();

    expect(() => provider.getNodeByName('NonExistent')).toThrow(
      'No node with name "NonExistent"'
    );

    expect(() => provider.getBlueIdByName('NonExistent')).toThrow(
      'No node with name "NonExistent"'
    );
  });
});
