import { describe, it, expect } from 'vitest';
import { BasicNodeProvider } from '../provider/BasicNodeProvider';
import { NodeExtender } from '../utils/NodeExtender';
import { PathLimits } from '../utils/limits/PathLimits';
import { NodeTypes } from '../utils';
import { Blue } from '../Blue';
import { BlueNode, NodeDeserializer } from '../model';
import { yamlBlueParse } from '../../utils/yamlBlue';
import { UnsupportedFeatureError } from '../utils/blueId';

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

    expect(
      NodeTypes.isSubtype(
        extended,
        extended.get('/x/type') as BlueNode,
        nodeProvider,
      ),
    ).toBe(true);
    expect(
      NodeTypes.isSubtype(
        aNode,
        extended.get('/x/type') as BlueNode,
        nodeProvider,
      ),
    ).toBe(true);
    expect(
      NodeTypes.isSubtype(
        extended.get('/x/type') as BlueNode,
        aNode,
        nodeProvider,
      ),
    ).toBe(true);
    expect(
      NodeTypes.isSubtype(
        extended.get('/x/type/x/type/x/type/x/type') as BlueNode,
        aNode,
        nodeProvider,
      ),
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

    expect(() => new BasicNodeProvider([node])).toThrow(
      UnsupportedFeatureError,
    );
  });
});
