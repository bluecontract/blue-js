import { JsonBlueValue } from '../../../schema';
import { yamlBlueParse } from '../../../utils';
import { BlueNode, NodeDeserializer } from '../../model';
import { NodePathAccessor } from '../NodePathAccessor';
import Big from 'big.js';

describe('NodePathAccessor', () => {
  let rootNode: BlueNode;

  beforeEach(() => {
    const yamlString = `
name: Root
type:
  name: RootType
  type:
    name: MetaType
value: RootValue
a:
  - name: A1
    type:
      name: TypeA
  - name: A2
    value: 42
b:
  name: B
  type:
    name: TypeB
  c:
    name: C
    value: ValueC
`;
    const parsedYaml = yamlBlueParse(yamlString) as JsonBlueValue;
    rootNode = NodeDeserializer.deserialize(parsedYaml);
  });

  test('root level access', () => {
    expect(rootNode.get('/name')).toBe('Root');
    expect(rootNode.get('/value')).toBe('RootValue');
    expect(rootNode.get('/type')).toBeInstanceOf(BlueNode);
    expect((rootNode.get('/type') as BlueNode).getName()).toBe('RootType');
  });

  test('nested access', () => {
    expect(rootNode.get('/b/name')).toBe('B');
    expect(rootNode.get('/b/c/value')).toBe('ValueC');
  });

  test('list access', () => {
    expect(rootNode.get('/a/0')).toBeInstanceOf(BlueNode);
    expect(rootNode.get('/a/0/name')).toBe('A1');
    expect(rootNode.get('/a/1/value')).toEqual(new Big('42'));
  });

  test('type access', () => {
    expect(rootNode.get('/a/0/type/name')).toBe('TypeA');
    expect(rootNode.get('/type/type/name')).toBe('MetaType');
  });

  // TODO:
  // test('blueId access', () => {
  //   expect(rootNode.get('/blueId')).not.toBeNull();
  //   expect(rootNode.get('/a/0/blueId')).not.toBeNull();
  // });

  test('invalid path', () => {
    expect(() => rootNode.get('/nonexistent')).toThrow();
    expect(() => rootNode.get('/a/5')).toThrow();
    expect(() => rootNode.get('invalid')).toThrow();
  });

  test('value precedence', () => {
    const nodeWithValue = new BlueNode().setName('Test').setValue('TestValue');
    const nodeWithoutValue = new BlueNode().setName('Test');

    expect(NodePathAccessor.get(nodeWithValue, '/')).toBe('TestValue');
    expect(NodePathAccessor.get(nodeWithValue, '/name')).toBe('Test');

    expect(NodePathAccessor.get(nodeWithoutValue, '/')).toBeInstanceOf(
      BlueNode
    );
    expect(NodePathAccessor.get(nodeWithoutValue, '/name')).toBe('Test');
  });
});
