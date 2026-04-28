import { describe, it, expect } from 'vitest';
import { BasicNodeProvider } from '../provider/BasicNodeProvider';
import { BlueNode, NodeDeserializer } from '../model';
import { yamlBlueParse } from '../../utils/yamlBlue';
import { Blue } from '../Blue';
import { CyclicSetIdentityService } from '../identity/CyclicSetIdentityService';

describe('SelfReferenceTest', () => {
  it('rejects unindexed single-document this references', () => {
    const a = `name: A
x:
  type:
    blueId: this`;

    const nodeProvider = new BasicNodeProvider();
    expect(() => nodeProvider.addSingleDocs(a)).toThrow(
      /Self-references using this or this#k are not supported/,
    );
  });

  it('assigns stable MASTER#i BlueIds for direct cyclic document sets', () => {
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
    const nodes = node.getItems() ?? [];
    const blue = new Blue();
    const publicMasterBlueId = blue.calculateBlueIdSync(doc!);

    const provider = new BasicNodeProvider([node]);
    const aBlueId = provider.getBlueIdByName('A');
    const bBlueId = provider.getBlueIdByName('B');
    const masterBlueId = aBlueId.split('#')[0];

    expect(publicMasterBlueId).toBe(masterBlueId);
    expect(bBlueId.split('#')[0]).toBe(masterBlueId);
    expect(new Set([aBlueId, bBlueId]).size).toBe(2);
    expect(aBlueId).toMatch(/#\d+$/);
    expect(bBlueId).toMatch(/#\d+$/);

    const fetchedSet = provider.fetchByBlueId(masterBlueId);
    expect(fetchedSet).toHaveLength(nodes.length);

    const aNode = provider.getNodeByName('A');
    const bNode = provider.getNodeByName('B');
    expect(aNode.get('/x/type/blueId')).toBe(bBlueId);
    expect(bNode.get('/y/type/blueId')).toBe(aBlueId);
  });

  it('does not treat ordinary multi-document this strings as direct cycles', () => {
    const docs = `- name: A
  note: this
- name: B
  note: this#1`;

    const node = NodeDeserializer.deserialize(yamlBlueParse(docs));
    const provider = new BasicNodeProvider([node]);

    expect(provider.getNodeByName('A').get('/note/value')).toBe('this');
    expect(provider.getNodeByName('B').get('/note/value')).toBe('this#1');
  });

  it('keeps cyclic MASTER stable when input order changes', () => {
    const first = yamlBlueParse(`- name: A
  peer:
    blueId: this#1
- name: B
  peer:
    blueId: this#0
`);
    const second = yamlBlueParse(`- name: B
  peer:
    blueId: this#1
- name: A
  peer:
    blueId: this#0
`);
    const blue = new Blue();

    expect(blue.calculateBlueIdSync(first!)).toBe(
      blue.calculateBlueIdSync(second!),
    );
  });

  it('orders cyclic preliminary ids by ASCII code point', () => {
    const service = new CyclicSetIdentityService({
      calculateBlueId: (value) => {
        if (Array.isArray(value)) {
          return 'MASTER';
        }

        const name = value.getName();
        if (name === 'lower') {
          return 'a';
        }
        if (name === 'upper') {
          return 'B';
        }
        throw new Error(`Unexpected test node: ${name ?? '<unnamed>'}`);
      },
    });
    const lower = new BlueNode('lower').addProperty(
      'peer',
      new BlueNode().setReferenceBlueId('this#1'),
    );
    const upper = new BlueNode('upper').addProperty(
      'peer',
      new BlueNode().setReferenceBlueId('this#0'),
    );

    const result = service.calculate([lower, upper]);

    expect(result.nodes.map((node) => node.getName())).toEqual([
      'upper',
      'lower',
    ]);
    expect(result.originalToSortedIndexes).toEqual([1, 0]);
    expect(result.nodes[0].get('/peer/blueId')).toBe('this#1');
    expect(result.nodes[1].get('/peer/blueId')).toBe('this#0');
  });

  it('rejects ambiguous cyclic ordering when preliminary BlueIds tie', () => {
    const doc = yamlBlueParse(`- peer:
    blueId: this#1
- peer:
    blueId: this#0
`);
    const blue = new Blue();

    expect(() => blue.calculateBlueIdSync(doc!)).toThrow(
      /ambiguous canonical ordering/,
    );
  });

  it('rejects cyclic references outside the top-level document set', () => {
    const provider = new BasicNodeProvider();
    const doc = NodeDeserializer.deserialize(
      yamlBlueParse(`- name: A
  peer:
    blueId: this#1
`),
    );

    expect(() => provider.addSingleNodes(doc)).toThrow(
      /points outside the 1-document set/,
    );
  });

  it('rejects local nested this#k cycles in single-document identity input', () => {
    const blue = new Blue();
    const doc = yamlBlueParse(`
name: LocalEntriesCycle
entries:
  items:
    - peer:
        blueId: this#0
`);

    expect(() => blue.calculateBlueIdSync(doc!)).toThrow(
      /top-level document set/,
    );
  });

  it('treats nested this#k in a cyclic set as references to top-level documents', () => {
    const provider = new BasicNodeProvider();
    const doc = NodeDeserializer.deserialize(
      yamlBlueParse(`- name: A
  entries:
    items:
      - peer:
          blueId: this#1
- name: B
  entries:
    items:
      - peer:
          blueId: this#0
`),
    );

    provider.addSingleNodes(doc);
    const aBlueId = provider.getBlueIdByName('A');
    const bBlueId = provider.getBlueIdByName('B');

    expect(provider.getNodeByName('A').get('/entries/0/peer/blueId')).toBe(
      bBlueId,
    );
    expect(provider.getNodeByName('B').get('/entries/0/peer/blueId')).toBe(
      aBlueId,
    );
  });
});
