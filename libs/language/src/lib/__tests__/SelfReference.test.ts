import { describe, it, expect } from 'vitest';
import { BasicNodeProvider } from '../provider/BasicNodeProvider';
import { NodeExtender } from '../utils/NodeExtender';
import { PathLimits } from '../utils/limits/PathLimits';
import { NodeTypes } from '../utils';
import { Blue } from '../Blue';
import { BlueNode, NodeDeserializer } from '../model';
import { yamlBlueParse } from '../../utils/yamlBlue';

describe('SelfReferenceTest', () => {
  it('testSingleDoc', () => {
    const a = `name: A
x:
  type:
    blueId: this`;

    const nodeProvider = new BasicNodeProvider();
    nodeProvider.addSingleDocs(a);

    const aNode = nodeProvider.getNodeByName('A');
    const extended = aNode.clone();
    new NodeExtender(nodeProvider).extend(
      extended,
      PathLimits.withSinglePath('/x/x/x/x')
    );

    expect(
      NodeTypes.isSubtype(
        extended,
        extended.get('/x/type') as BlueNode,
        nodeProvider
      )
    ).toBe(true);
    expect(
      NodeTypes.isSubtype(
        aNode,
        extended.get('/x/type') as BlueNode,
        nodeProvider
      )
    ).toBe(true);
    expect(
      NodeTypes.isSubtype(
        extended.get('/x/type') as BlueNode,
        aNode,
        nodeProvider
      )
    ).toBe(true);
    expect(
      NodeTypes.isSubtype(
        extended.get('/x/type/x/type/x/type/x/type') as BlueNode,
        aNode,
        nodeProvider
      )
    ).toBe(true);
  });

  it('testTwoInterconnectedDocs', async () => {
    const ab = `- name: A
  x:
    type:
      blueId: this#1
  aVal:
    type: Text
- name: B
  y:
    type:
      blueId: this#0
  bVal:
    type: Text
  bConst: xyz`;

    const doc = yamlBlueParse(ab);
    const node = NodeDeserializer.deserialize(doc);
    const nodeProvider = new BasicNodeProvider([node]);

    const aNode = nodeProvider.getNodeByName('A');
    const bNode = nodeProvider.getNodeByName('B');
    const aNodeBlueId = aNode.getBlueId();

    const extendedA = aNode.clone();
    const extendedB = bNode.clone();
    new NodeExtender(nodeProvider).extend(
      extendedA,
      PathLimits.withSinglePath('/x/y/x/y')
    );
    new NodeExtender(nodeProvider).extend(
      extendedB,
      PathLimits.withSinglePath('/y/x/y/x')
    );

    expect(
      NodeTypes.isSubtype(
        extendedA,
        extendedB.get('/y/type') as BlueNode,
        nodeProvider
      )
    ).toBe(true);
    expect(
      NodeTypes.isSubtype(
        extendedB,
        extendedA.get('/x/type/y/type/x/type') as BlueNode,
        nodeProvider
      )
    ).toBe(true);

    const instance = `name: Some
a:
  type:
    blueId: ${aNodeBlueId}
  aVal: abcd
  x:
    bVal: abcd`;

    const blue = new Blue({ nodeProvider });
    const instanceNode = blue.yamlToNode(instance);
    const preprocessedNode = await blue.preprocess(instanceNode);
    const result = await blue.resolve(
      preprocessedNode,
      PathLimits.withSinglePath('/*/*/*')
    );

    expect(result.get('/a/x/bConst')).toBe('xyz');

    const errorInstance = `name: Some
a:
  type: 
    blueId: ${aNodeBlueId}
  aVal: abcd
  x:
    bVal: abcd
    y:
      aVal: 
        type: Integer
        value: 423423`;

    const errorNode = blue.yamlToNode(errorInstance);
    const preprocessedErrorNode = await blue.preprocess(errorNode);

    let errorThrown = false;
    try {
      await blue.resolve(
        preprocessedErrorNode,
        PathLimits.withSinglePath('/*/*/*/*')
      );
    } catch (e) {
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);
  });
});
