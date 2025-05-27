import { BigIntegerNumber, BlueNode, NodeDeserializer } from '../../model';
import { NodeProvider, createNodeProvider } from '../../NodeProvider';
import { InMemoryNodeProvider } from '../../provider/InMemoryNodeProvider';
import { NodeExtender } from '../NodeExtender';
import { PathLimitsBuilder } from '../limits/PathLimits';
import { Limits } from '../limits/Limits';
import { yamlBlueParse } from '../../../utils';
import { BlueIdCalculator } from '../BlueIdCalculator';

describe('NodeExtender', () => {
  let nodes: Map<string, BlueNode>;
  let nodeProvider: NodeProvider;
  let nodeExtender: NodeExtender;

  beforeEach(() => {
    const a = `
name: A
x: 1
y:
  z: 1`;

    const b = `
name: B
type:
  blueId: blueId-A
x: 2`;

    const c = `
name: C
type:
  blueId: blueId-B
x: 3`;

    const x = `
name: X
a:
  type:
    blueId: blueId-A
b:
  type:
    blueId: blueId-B
c:
  type:
    blueId: blueId-C
d:
  - blueId: blueId-C
  - blueId: blueId-A`;

    const y = `
name: Y
forA:
  blueId: blueId-A
forX:
  blueId: blueId-X`;

    nodes = [a, b, c, x, y].reduce((acc, doc) => {
      const parsed = yamlBlueParse(doc);
      if (parsed === undefined) {
        console.error(`Failed to parse YAML: ${doc}`);
        return acc;
      }
      const node = NodeDeserializer.deserialize(parsed);
      acc.set(node.getName() as string, node);
      return acc;
    }, new Map<string, BlueNode>());

    // Use createNodeProvider instead of implementing interface directly
    nodeProvider = createNodeProvider((blueId: string): BlueNode[] => {
      if (blueId === 'blueId-A') {
        return [nodes.get('A') as BlueNode];
      } else if (blueId === 'blueId-B') {
        return [nodes.get('B') as BlueNode];
      } else if (blueId === 'blueId-C') {
        return [nodes.get('C') as BlueNode];
      } else if (blueId === 'blueId-X') {
        return [nodes.get('X') as BlueNode];
      }
      return [];
    });

    nodeExtender = new NodeExtender(nodeProvider);
  });

  test('testExtendSingleProperty', async () => {
    const node = nodes.get('Y')?.clone() as BlueNode;

    const limits: Limits = new PathLimitsBuilder().addPath('/forA').build();
    nodeExtender.extend(node, limits);

    expect(await node.get('/forA/name')).toBe('A');

    expect((await node.get('/forA/x'))?.toString()).toBe('1');
    expect((await node.get('/forA/y/z'))?.toString()).toBe('1');

    expect(await node.get('/forX/a')).toBeUndefined();
  });

  test('testExtendNestedProperty', async () => {
    const node = nodes.get('Y')?.clone() as BlueNode;
    const limits: Limits = new PathLimitsBuilder().addPath('/forX/a').build();
    nodeExtender.extend(node, limits);

    expect(await node.get('/forX/name')).toBe('X');
    expect(await node.get('/forX/a/type/name')).toBe('A');
    expect((await node.get('/forX/a/type/x'))?.toString()).toBe('1');
  });

  test('testExtendListItem', async () => {
    const node = nodes.get('Y')?.clone() as BlueNode;
    const limits: Limits = new PathLimitsBuilder().addPath('/forX/d/0').build();
    nodeExtender.extend(node, limits);

    expect(await node.get('/forX/name')).toBe('X');
    expect(await node.get('/forX/d/0/name')).toBe('C');
    expect(await node.get('/forX/d/0/type/name')).toBe('B');
    expect((await node.get('/forX/d/0/type/x'))?.toString()).toBe('2');
  });

  test('testExtendWithMultiplePaths', async () => {
    const node = nodes.get('Y')?.clone() as BlueNode;
    const limits: Limits = new PathLimitsBuilder()
      .addPath('/forA')
      .addPath('/forX/b')
      .build();
    nodeExtender.extend(node, limits);

    expect(await node.get('/forA/name')).toBe('A');
    expect((await node.get('/forA/x'))?.toString()).toBe('1');
    expect(await node.get('/forX/name')).toBe('X');
    expect(await node.get('/forX/a/prop')).toBeUndefined();
  });

  test('testExtendList', async () => {
    const nodeProvider = new InMemoryNodeProvider();

    const a = `
name: A
value: 1`;

    const b = `
name: B
value: 2`;

    const c = `
name: C
value: 3`;

    const [nodeA, nodeB, nodeC] = [a, b, c]
      .map((doc) => {
        const parsed = yamlBlueParse(doc);
        if (parsed === undefined) {
          console.error(`Failed to parse YAML: ${doc}`);
          return;
        }
        const node = NodeDeserializer.deserialize(parsed);
        return node;
      })
      .filter((node): node is BlueNode => node !== undefined);

    nodeProvider.addSingleNodes(nodeA, nodeB, nodeC);

    const listBlueId = BlueIdCalculator.calculateBlueIdSync([nodeA, nodeB]);
    nodeProvider.addListAndItsItems([nodeA, nodeB]);

    const blueIdC = BlueIdCalculator.calculateBlueIdSync(nodeC);

    const listDocument = `  
name: ListNode
items:
  - blueId: ${listBlueId}
  - blueId: ${blueIdC}`;

    const parsedListDocument = yamlBlueParse(listDocument);
    if (parsedListDocument === undefined) {
      console.error(`Failed to parse YAML: ${listDocument}`);
      return;
    }

    const listNode = NodeDeserializer.deserialize(parsedListDocument);
    nodeProvider.addSingleNodes(listNode);

    const nodeExtender = new NodeExtender(nodeProvider);

    const limits = new PathLimitsBuilder().addPath('/*').build();
    nodeExtender.extend(listNode, limits);

    expect(listNode.getName()).toBe('ListNode');
    expect(listNode.getItems()?.length).toBe(3);

    expect(await listNode.get('/0/name')).toBe('A');
    expect(await listNode.get('/0/value')).toStrictEqual(
      new BigIntegerNumber(1)
    );

    expect(await listNode.get('/1/name')).toBe('B');
    expect(await listNode.get('/1/value')).toStrictEqual(
      new BigIntegerNumber(2)
    );

    expect(await listNode.get('/2/name')).toBe('C');
    expect(await listNode.get('/2/value')).toStrictEqual(
      new BigIntegerNumber(3)
    );
  });

  test('testExtendListDirectly', async () => {
    const nodeProvider = new InMemoryNodeProvider();

    const a = `
name: A
value: 1`;

    const b = `
name: B
value: 2`;

    const c = `
name: C
value: 3`;

    const [nodeA, nodeB, nodeC] = [a, b, c]
      .map((doc) => {
        const parsed = yamlBlueParse(doc);
        if (parsed === undefined) {
          console.error(`Failed to parse YAML: ${doc}`);
          return;
        }
        const node = NodeDeserializer.deserialize(parsed);
        return node;
      })
      .filter((node): node is BlueNode => node !== undefined);

    nodeProvider.addSingleNodes(nodeA, nodeB, nodeC);

    // Create a list of A and B nodes
    const listABBlueId = BlueIdCalculator.calculateBlueIdSync([nodeA, nodeB]);
    nodeProvider.addList([nodeA, nodeB]);

    // Create a reference node for AB list
    const abDocument = `blueId: ${listABBlueId}`;
    const parsedABDocument = yamlBlueParse(abDocument);
    if (parsedABDocument === undefined) {
      console.error(`Failed to parse YAML: ${abDocument}`);
      return;
    }
    const nodeAB = NodeDeserializer.deserialize(parsedABDocument);

    // Create a list of AB reference and C
    nodeProvider.addList([nodeAB, nodeC]);
    const listABCBlueId = BlueIdCalculator.calculateBlueIdSync([nodeAB, nodeC]);

    // Create a reference node for the final ABC list
    const abcDocument = `blueId: ${listABCBlueId}`;
    const parsedABCDocument = yamlBlueParse(abcDocument);
    if (parsedABCDocument === undefined) {
      console.error(`Failed to parse YAML: ${abcDocument}`);
      return;
    }
    const nodeABC = NodeDeserializer.deserialize(parsedABCDocument);

    const nodeExtender = new NodeExtender(nodeProvider);

    const limits = new PathLimitsBuilder().addPath('/*').build();
    nodeExtender.extend(nodeABC, limits);

    expect(nodeABC.getItems()?.length).toBe(3);

    expect(await nodeABC.get('/0/name')).toBe('A');
    expect(await nodeABC.get('/0/value')).toStrictEqual(
      new BigIntegerNumber(1)
    );

    expect(await nodeABC.get('/1/name')).toBe('B');
    expect(await nodeABC.get('/1/value')).toStrictEqual(
      new BigIntegerNumber(2)
    );

    expect(await nodeABC.get('/2/name')).toBe('C');
    expect(await nodeABC.get('/2/value')).toStrictEqual(
      new BigIntegerNumber(3)
    );
  });
});
