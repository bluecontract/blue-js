import { describe, it, expect } from 'vitest';
import { BasicNodeProvider } from '../provider/BasicNodeProvider';
import { NodeExtender } from '../utils/NodeExtender';
import { PathLimits } from '../utils/limits/PathLimits';
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
      PathLimits.withSinglePath('/x/x/x/x'),
    );

    const aNodeBlueId = nodeProvider.getBlueIdByName('A');
    expect((aNode.get('/x/type') as BlueNode).getBlueId()).toBe(aNodeBlueId);
    expect((extended.get('/x/type/x/type') as BlueNode).getBlueId()).toBe(
      aNodeBlueId,
    );
    expect(
      (extended.get('/x/type/x/type/x/type/x/type') as BlueNode).getBlueId(),
    ).toBe(aNodeBlueId);
  });

  it('rejects direct cyclic multi-document sets until phase 3', () => {
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

    expect(() => new BasicNodeProvider([node])).toThrow(
      /Direct cyclic multi-document sets using this#k are not supported until phase 3/,
    );
  });
});
