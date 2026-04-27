import { BigIntegerNumber, BlueNode, NodeDeserializer } from '../../model';
import { NodeProvider, createNodeProvider } from '../../NodeProvider';
import { InMemoryNodeProvider } from '../../provider/InMemoryNodeProvider';
import { NodeExtender } from '../NodeExtender';
import { PathLimitsBuilder } from '../limits/PathLimits';
import { Limits } from '../limits/Limits';
import { yamlBlueParse } from '../../../utils';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { NO_LIMITS } from '../limits';

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

  test('expands list reference items as nested list content without flattening', async () => {
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

    const nestedListBlueId = BlueIdCalculator.calculateBlueIdSync([
      nodeA,
      nodeB,
    ]);
    nodeProvider.addListAndItsItems([nodeA, nodeB]);

    const blueIdC = BlueIdCalculator.calculateBlueIdSync(nodeC);

    const outerListDocument = `  
name: ListNode
items:
  - blueId: ${nestedListBlueId}
  - blueId: ${blueIdC}`;

    const parsedOuterListDocument = yamlBlueParse(outerListDocument);
    if (parsedOuterListDocument === undefined) {
      console.error(`Failed to parse YAML: ${outerListDocument}`);
      return;
    }

    const outerListNode = NodeDeserializer.deserialize(parsedOuterListDocument);
    nodeProvider.addSingleNodes(outerListNode);

    const nodeExtender = new NodeExtender(nodeProvider);

    const limits = new PathLimitsBuilder().addPath('/*').build();
    nodeExtender.extend(outerListNode, limits);

    const nestedListItem = outerListNode.getItems()?.[0];
    expect(outerListNode.getName()).toBe('ListNode');
    expect(outerListNode.getItems()?.length).toBe(2);
    expect(nestedListItem?.getReferenceBlueId()).toBeUndefined();
    expect(nestedListItem?.getProperties()?.['$previous']).toBeUndefined();
    expect(nestedListItem?.getItems()).toHaveLength(2);

    expect(await outerListNode.get('/0/0/name')).toBe('A');
    expect(await outerListNode.get('/0/0/value')).toStrictEqual(
      new BigIntegerNumber(1),
    );

    expect(await outerListNode.get('/0/1/name')).toBe('B');
    expect(await outerListNode.get('/0/1/value')).toStrictEqual(
      new BigIntegerNumber(2),
    );

    expect(await outerListNode.get('/1/name')).toBe('C');
    expect(await outerListNode.get('/1/value')).toStrictEqual(
      new BigIntegerNumber(3),
    );
  });

  test('expands a root list reference that contains a nested list reference without flattening', async () => {
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

    const nestedListBlueId = BlueIdCalculator.calculateBlueIdSync([
      nodeA,
      nodeB,
    ]);
    nodeProvider.addList([nodeA, nodeB]);

    const nestedListRefDocument = `blueId: ${nestedListBlueId}`;
    const parsedNestedListRefDocument = yamlBlueParse(nestedListRefDocument);
    if (parsedNestedListRefDocument === undefined) {
      console.error(`Failed to parse YAML: ${nestedListRefDocument}`);
      return;
    }
    const nestedListRef = NodeDeserializer.deserialize(
      parsedNestedListRefDocument,
    );

    nodeProvider.addList([nestedListRef, nodeC]);
    const outerListBlueId = BlueIdCalculator.calculateBlueIdSync([
      nestedListRef,
      nodeC,
    ]);

    const outerListRefDocument = `blueId: ${outerListBlueId}`;
    const parsedOuterListRefDocument = yamlBlueParse(outerListRefDocument);
    if (parsedOuterListRefDocument === undefined) {
      console.error(`Failed to parse YAML: ${outerListRefDocument}`);
      return;
    }
    const outerListRef = NodeDeserializer.deserialize(
      parsedOuterListRefDocument,
    );

    const nodeExtender = new NodeExtender(nodeProvider);

    const limits = new PathLimitsBuilder().addPath('/*').build();
    nodeExtender.extend(outerListRef, limits);

    const nestedListItem = outerListRef.getItems()?.[0];
    expect(outerListRef.getReferenceBlueId()).toBeUndefined();
    expect(outerListRef.getItems()?.length).toBe(2);
    expect(nestedListItem?.getReferenceBlueId()).toBeUndefined();
    expect(nestedListItem?.getProperties()?.['$previous']).toBeUndefined();
    expect(nestedListItem?.getItems()).toHaveLength(2);

    expect(await outerListRef.get('/0/0/name')).toBe('A');
    expect(await outerListRef.get('/0/0/value')).toStrictEqual(
      new BigIntegerNumber(1),
    );

    expect(await outerListRef.get('/0/1/name')).toBe('B');
    expect(await outerListRef.get('/0/1/value')).toStrictEqual(
      new BigIntegerNumber(2),
    );

    expect(await outerListRef.get('/1/name')).toBe('C');
    expect(await outerListRef.get('/1/value')).toStrictEqual(
      new BigIntegerNumber(3),
    );
  });

  test('does not mutate provider-stored content after expanding a reference', () => {
    const stored = NodeDeserializer.deserialize(
      yamlBlueParse(`
name: Base
nested:
  value: original
`)!,
    );
    const provider = createNodeProvider((blueId: string): BlueNode[] =>
      blueId === 'base-id' ? [stored] : [],
    );
    const nodeExtender = new NodeExtender(provider);
    const ref = new BlueNode().setReferenceBlueId('base-id');

    nodeExtender.extend(ref, NO_LIMITS);

    ref.getProperties()?.nested?.setValue('changed');

    expect(stored.getProperties()?.nested?.getValue()).toBe('original');
  });
});
