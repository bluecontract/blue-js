import { BasicNodeProvider } from '../../provider';
import { Blue } from '../../Blue';
import { MergeReverser } from '../MergeReverser';
import { TEXT_TYPE_BLUE_ID } from '../Properties';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { BlueNode } from '../../model';

describe('MergeReverser', () => {
  it('testBasic1', () => {
    const nodeProvider = new BasicNodeProvider();

    const a = `
      name: A
      description: Xyz
      x: 1
      y:
        type: Integer
      z:
        type: List
    `;
    nodeProvider.addSingleDocs(a);

    const b = `
      name: B
      type:
        blueId: ${nodeProvider.getBlueIdByName('A')}
      x: 1
      y: 2
      z:
        type: List
        itemType: Text
        items:
          - A
          - B
    `;
    nodeProvider.addSingleDocs(b);

    const bNode = nodeProvider.getNodeByName('B');

    const blue = new Blue({ nodeProvider });
    const resolved = blue.resolve(bNode).toBlueNode();

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(resolved);

    expect(reversed.getProperties()?.['x']).toBeUndefined();
    expect(reversed.getAsInteger('/y/value')).toEqual(2);
    expect(reversed.get('/z/type')).toBeUndefined();
    expect(reversed.get('/z/itemType/blueId')).toEqual(TEXT_TYPE_BLUE_ID);
  });

  it('testNestedTypes', () => {
    const nodeProvider = new BasicNodeProvider();

    const a = `
      name: A
      x: 5
      y: 10
    `;
    nodeProvider.addSingleDocs(a);

    const b = `
      name: B
      type:
        blueId: ${nodeProvider.getBlueIdByName('A')}
      z: 15
    `;
    nodeProvider.addSingleDocs(b);

    const c = `
      name: C
      type:
        blueId: ${nodeProvider.getBlueIdByName('B')}
      w: 20
    `;
    nodeProvider.addSingleDocs(c);

    const cNode = nodeProvider.getNodeByName('C');
    const blue = new Blue({ nodeProvider });
    const resolved = blue.resolve(cNode).toBlueNode();

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(resolved);

    expect(reversed.getName()).toEqual('C');
    expect(reversed.getType()?.getBlueId()).toEqual(
      nodeProvider.getBlueIdByName('B')
    );
    expect(reversed.getAsInteger('/w')).toEqual(20);
    expect(reversed.getProperties()?.['x']).toBeUndefined();
    expect(reversed.getProperties()?.['y']).toBeUndefined();
    expect(reversed.getProperties()?.['z']).toBeUndefined();
  });

  it('testComplexNestedProperties', () => {
    const nodeProvider = new BasicNodeProvider();

    const m = `
      name: M
      a:
        b:
          c:
            d1: 1
    `;
    nodeProvider.addSingleDocs(m);

    const n = `
      name: N
      c:
        d2: 1
    `;
    nodeProvider.addSingleDocs(n);

    const p = `
      name: P
      type:
        blueId: ${nodeProvider.getBlueIdByName('M')}
      a:
        b:
          type:
            blueId: ${nodeProvider.getBlueIdByName('N')}
          c:
            d3: 3
    `;
    nodeProvider.addSingleDocs(p);

    const blue = new Blue({ nodeProvider });
    const nodeP = blue.yamlToNode(p);
    const blueIdP = blue.calculateBlueIdSync(nodeP);

    const resolved = blue.resolve(nodeP).toBlueNode();

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(resolved);

    expect(blue.calculateBlueIdSync(reversed)).toEqual(blueIdP);

    expect(reversed.getName()).toEqual('P');
    expect(reversed.getType()?.getBlueId()).toEqual(
      nodeProvider.getBlueIdByName('M')
    );
    expect((reversed.get('/a/b/type') as BlueNode)?.getBlueId()).toEqual(
      nodeProvider.getBlueIdByName('N')
    );
    expect(reversed.getAsInteger('/a/b/c/d3/value')).toEqual(3);
    const cNode = reversed.getAsNode('/a/b/c');
    expect(cNode?.getProperties()?.['d2']).toBeUndefined();
    expect(cNode?.getProperties()?.['d1']).toBeUndefined();
  });

  it('testInheritedListAndMap', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
      map:
        key1: value1
        key2: value2
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - A
        - B
        - C
      map:
        key3: value3
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode).toBlueNode();

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(resolved);

    expect(reversed.getName()).toEqual('Derived');
    expect(reversed.getType()?.getBlueId()).toEqual(
      nodeProvider.getBlueIdByName('Base')
    );
    expect(reversed.getAsNode('/list')?.getItems()?.length).toEqual(2);

    const listBlueId = BlueIdCalculator.calculateBlueIdSync([
      blue.yamlToNode('value: A\ntype: Text'),
      blue.yamlToNode('value: B\ntype: Text'),
    ]);
    expect(reversed.getAsNode('/list')?.getItems()?.[0].getBlueId()).toEqual(
      listBlueId
    );
    expect(reversed.getAsNode('/list')?.getItems()?.[1].getValue()).toEqual(
      'C'
    );
    expect(
      Object.keys(reversed.getAsNode('/map')?.getProperties() || {}).length
    ).toEqual(1);
    expect(reversed.get('/map/key3/value')).toEqual('value3');
  });
});
