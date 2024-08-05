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

  test('root level access', async () => {
    expect(await rootNode.get('/name')).toBe('Root');
    expect(await rootNode.get('/value')).toBe('RootValue');
    expect(await rootNode.get('/type')).toBeInstanceOf(BlueNode);
    expect(((await rootNode.get('/type')) as BlueNode).getName()).toBe(
      'RootType'
    );
  });

  test('nested access', async () => {
    expect(await rootNode.get('/b/name')).toBe('B');
    expect(await rootNode.get('/b/c/value')).toBe('ValueC');
  });

  test('list access', async () => {
    expect(await rootNode.get('/a/0')).toBeInstanceOf(BlueNode);
    expect(await rootNode.get('/a/0/name')).toBe('A1');
    expect(await rootNode.get('/a/1/value')).toEqual(new Big('42'));
  });

  test('type access', async () => {
    expect(await rootNode.get('/a/0/type/name')).toBe('TypeA');
    expect(await rootNode.get('/type/type/name')).toBe('MetaType');
  });

  test('blueId access', async () => {
    expect(await rootNode.get('/blueId')).not.toBeNull();
    expect(await rootNode.get('/a/0/blueId')).not.toBeNull();
  });

  test('invalid path', async () => {
    expect(() => rootNode.get('/nonexistent')).rejects.toThrow();
    expect(() => rootNode.get('/a/5')).rejects.toThrow();
    expect(() => rootNode.get('invalid')).rejects.toThrow();
  });

  test('value precedence', async () => {
    const nodeWithValue = new BlueNode().setName('Test').setValue('TestValue');
    const nodeWithoutValue = new BlueNode().setName('Test');

    expect(await NodePathAccessor.get(nodeWithValue, '/')).toBe('TestValue');
    expect(await NodePathAccessor.get(nodeWithValue, '/name')).toBe('Test');

    expect(await NodePathAccessor.get(nodeWithoutValue, '/')).toBeInstanceOf(
      BlueNode
    );
    expect(await NodePathAccessor.get(nodeWithoutValue, '/name')).toBe('Test');
  });
});
