import { describe, it, expect } from 'vitest';
import { BasicNodeProvider } from '../provider/BasicNodeProvider';
import { NodeDeserializer } from '../model';
import { yamlBlueParse } from '../../utils/yamlBlue';

describe('SelfReferenceTest', () => {
  it('rejects single-document this references until phase 3', () => {
    const a = `name: A
x:
  type:
    blueId: this`;

    const nodeProvider = new BasicNodeProvider();
    expect(() => nodeProvider.addSingleDocs(a)).toThrow(
      /Self-references using this or this#k are not supported/,
    );
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
      /Self-references using this or this#k are not supported/,
    );
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
});
