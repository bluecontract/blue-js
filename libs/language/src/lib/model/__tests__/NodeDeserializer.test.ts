import { NodeDeserializer } from '../NodeDeserializer';
import Big from 'big.js';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { JsonBlueValue } from '../../../schema';

describe('NodeDeserializer', () => {
  it('testBasics', () => {
    const doc =
      'name: name\n' +
      'description: description\n' +
      'type: type\n' +
      'value: value\n' +
      'ref: ref\n' +
      'blueId: blueId\n' +
      'x: x\n' +
      'y:\n' +
      '  y1: y1\n' +
      '  y2:\n' +
      '    value: y2';

    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    const node = NodeDeserializer.deserialize(map1);

    expect(node.getName()).toEqual('name');
    expect(node.getDescription()).toEqual('description');
    expect(node.getType()?.getName()).toEqual('type');
    expect(node.getValue()).toEqual('value');
    expect(node.getRef()).toEqual('ref');
    expect(node.getBlueId()).toEqual('blueId');
    expect(node.getProperties()?.['x'].getValue()).toEqual('x');

    const y = node.getProperties()?.['y'];
    expect(y?.getProperties()?.['y1'].getValue()).toEqual('y1');
    expect(y?.getProperties()?.['y2'].getValue()).toEqual('y2');
  });

  it('testNumbers', () => {
    const doc =
      'int: 132452345234524739582739458723948572934875\n' +
      'dec: 132452345234524739582739458723948572934875.132452345234524739582739458723948572934875';

    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    const node = NodeDeserializer.deserialize(map1);

    expect(node.getProperties()?.['int'].getValue()).toEqual(
      new Big('132452345234524739582739458723948572934875')
    );
    expect(node.getProperties()?.['dec'].getValue()).toEqual(
      new Big(
        '132452345234524739582739458723948572934875.132452345234524739582739458723948572934875'
      )
    );
  });

  it('testType', () => {
    const doc =
      'a:\n' +
      '  type: Integer\n' +
      'b:\n' +
      '  type:\n' +
      '    name: Integer\n' +
      'c:\n' +
      '  type: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH\n' +
      'd:\n' +
      '  type:\n' +
      '    blueId: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH';

    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    const node = NodeDeserializer.deserialize(map1);

    expect('Integer').toEqual(node.getProperties()?.['a'].getType()?.getName());
    expect('Integer').toEqual(node.getProperties()?.['b'].getType()?.getName());
    expect('84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH').toEqual(
      node.getProperties()?.['c'].getType()?.getBlueId()
    );
    expect('84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH').toEqual(
      node.getProperties()?.['d'].getType()?.getBlueId()
    );
  });

  it('testBlueId', () => {
    const doc =
      'name: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH\n' +
      'description: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH\n' +
      'x: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH\n' +
      'y:\n' +
      '  value: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH';

    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    const node = NodeDeserializer.deserialize(map1);

    expect(node.getName()).toEqual(
      '84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH'
    );
    expect(node.getDescription()).toEqual(
      '84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH'
    );
    expect(node.getProperties()?.['x'].getBlueId()).toEqual(
      '84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH'
    );
    expect(node.getProperties()?.['y'].getValue()).toEqual(
      '84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH'
    );
  });

  it('testItems', () => {
    const doc =
      'name: Abc\n' +
      'props1:\n' +
      '  items:\n' +
      '    - name: A\n' +
      '    - name: B\n' +
      'props2:\n' +
      '  - name: A\n' +
      '  - name: B';

    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    const node = NodeDeserializer.deserialize(map1);

    expect(node.getName()).toEqual('Abc');
    expect(node.getProperties()?.['props1'].getItems()).toHaveLength(2);
    expect(node.getProperties()?.['props2'].getItems()).toHaveLength(2);
  });

  it('testText', () => {
    const doc = 'abc';
    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    const node = NodeDeserializer.deserialize(map1);

    expect(node.getValue()).toEqual('abc');
  });

  it('testList', () => {
    const doc = '- A\n- B';
    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    const node = NodeDeserializer.deserialize(map1);

    expect(node.getItems()).toHaveLength(2);
  });

  it('testEmpty', () => {
    const doc = '';
    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    expect(() => NodeDeserializer.deserialize(map1)).toThrowError(
      `This is not a valid JSON-like value. Found 'undefined' as a value.`
    );
  });
});
