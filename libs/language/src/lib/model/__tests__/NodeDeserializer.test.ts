import { NodeDeserializer } from '../NodeDeserializer';
import Big from 'big.js';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { JsonBlueValue } from '../../../schema';
import {
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
} from '../../utils/Properties';

describe('NodeDeserializer', () => {
  it('testBasics', () => {
    const doc =
      'name: name\n' +
      'description: description\n' +
      'type: type\n' +
      'value: value\n' +
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
    expect(node.getType()?.getValue()).toEqual('type');
    expect(node.getValue()).toEqual('value');
    expect(node.getBlueId()).toEqual('blueId');
    expect(node.getProperties()?.['x'].getValue()).toEqual('x');

    const y = node.getProperties()?.['y'];
    const y1 = y?.getProperties()?.['y1'];
    expect(y1?.getValue()).toEqual('y1');
    expect(y1?.isInlineValue()).toBeTruthy();

    const y2 = y?.getProperties()?.['y2'];
    expect(y2?.getValue()).toEqual('y2');
    expect(y2?.isInlineValue()).toBeFalsy();
  });

  it('testNumbers', () => {
    const doc =
      'int1: 9007199254740991\n' +
      'int2: 132452345234524739582739458723948572934875\n' +
      'int3:\n' +
      '  type:\n' +
      '    blueId: ' +
      INTEGER_TYPE_BLUE_ID +
      '\n' +
      '  value: "132452345234524739582739458723948572934875"\n' +
      'dec1: 132452345234524739582739458723948572934875.132452345234524739582739458723948572934875\n' +
      'dec2:\n' +
      '  type:\n' +
      '    blueId: ' +
      DOUBLE_TYPE_BLUE_ID +
      '\n' +
      '  value: "132452345234524739582739458723948572934875.132452345234524739582739458723948572934875"\n';

    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    const node = NodeDeserializer.deserialize(map1);

    expect(node.getProperties()?.['int1'].getValue()).toEqual(
      new Big('9007199254740991')
    );
    expect(node.getProperties()?.['int2'].getValue()).toEqual(
      new Big('9007199254740991')
    );
    expect(node.getProperties()?.['int3'].getValue()).toEqual(
      new Big('132452345234524739582739458723948572934875')
    );
    expect(node.getProperties()?.['dec1'].getValue()).toEqual(
      new Big('1.3245234523452473E+41')
    );
    expect(node.getProperties()?.['dec2'].getValue()).toEqual(
      new Big('1.3245234523452473E+41')
    );
  });

  it('testType', () => {
    const doc =
      'a:\n' +
      '  type:\n' +
      '    name: Integer\n' +
      'b:\n' +
      '  type:\n' +
      '    name: Integer\n' +
      'c:\n' +
      '  type:\n' +
      '    blueId: 84ZWw2aoqB6dWRM6N1qWwgcXGrjfeKexTNdWxxAEcECH\n' +
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
    expect(node.getProperties()?.['x'].getValue()).toEqual(
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

  it('testContracts', () => {
    const doc =
      'name: Contract\n' +
      'description: Contract description\n' +
      'contracts:\n' +
      '  partyA:\n' +
      '    name: Alice\n' +
      '    role: Buyer\n' +
      '  partyB:\n' +
      '    name: Bob\n' +
      '    role: Seller\n' +
      '    details:\n' +
      '      companyId: 12345\n' +
      '  terms:\n' +
      '    items:\n' +
      '      - name: Term1\n' +
      '        description: First term\n' +
      '      - name: Term2\n' +
      '        description: Second term';

    const map1 = yamlBlueParse(doc) as JsonBlueValue;
    const node = NodeDeserializer.deserialize(map1);

    expect(node.getName()).toEqual('Contract');
    expect(node.getDescription()).toEqual('Contract description');

    const contracts = node.getContracts();
    expect(contracts).toBeDefined();

    // Test partyA contract
    const partyA = contracts?.['partyA'];
    expect(partyA).toBeDefined();
    expect(partyA?.getName()).toEqual('Alice');
    expect(partyA?.getProperties()?.['role'].getValue()).toEqual('Buyer');

    // Test partyB contract with nested property
    const partyB = contracts?.['partyB'];
    expect(partyB).toBeDefined();
    expect(partyB?.getName()).toEqual('Bob');
    expect(partyB?.getProperties()?.['role'].getValue()).toEqual('Seller');
    expect(
      partyB
        ?.getProperties()
        ?.['details'].getProperties()
        ?.['companyId'].getValue()
    ).toEqual(new Big('12345'));

    // Test terms contract with items
    const terms = contracts?.['terms'];
    expect(terms).toBeDefined();
    expect(terms?.getItems()).toHaveLength(2);
    expect(terms?.getItems()?.[0].getName()).toEqual('Term1');
    expect(terms?.getItems()?.[0].getDescription()).toEqual('First term');
    expect(terms?.getItems()?.[1].getName()).toEqual('Term2');
    expect(terms?.getItems()?.[1].getDescription()).toEqual('Second term');
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
