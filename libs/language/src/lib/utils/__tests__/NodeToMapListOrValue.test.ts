import { JsonObject, JsonValue } from 'type-fest';
import { BlueNode } from '../../model/Node';
import { NodeToMapListOrValue } from '../NodeToMapListOrValue';
import {
  BigDecimalNumber,
  BigIntegerNumber,
  NodeDeserializer,
} from '../../model';

describe('NodeToMapListOrValue', () => {
  it('testBasicStandardStrategy', () => {
    const node = new BlueNode()
      .setName('nameA')
      .setDescription('descriptionA')
      .setType(new BlueNode().setName('nameB').setDescription('descriptionB'))
      .setProperties({
        a: new BlueNode().setValue('xyz1'),
        b: new BlueNode().setValue('xyz2').setDescription('descriptionXyz2'),
      });

    const object = NodeToMapListOrValue.get(node);
    expect(typeof object).toBe('object');

    const result = object as Record<string, unknown>;
    expect(result['name']).toEqual('nameA');
    expect(result['description']).toEqual('descriptionA');

    const type = result['type'] as Record<string, unknown>;
    expect(type).toBeDefined();
    expect(type['name']).toEqual('nameB');
    expect(type['description']).toEqual('descriptionB');

    const propertyA = result['a'] as Record<string, unknown>;
    expect(propertyA).toBeDefined();
    expect(propertyA['value']).toEqual('xyz1');

    const propertyB = result['b'] as Record<string, unknown>;
    expect(propertyB).toBeDefined();
    expect(propertyB['value']).toEqual('xyz2');
    expect(propertyB['description']).toEqual('descriptionXyz2');
  });

  it('testBasicDomainMappingStrategy', () => {
    const node = new BlueNode()
      .setName('nameA')
      .setDescription('descriptionA')
      .setType(new BlueNode().setName('nameB').setDescription('descriptionB'))
      .setProperties({
        a: new BlueNode().setValue('xyz1'),
        b: new BlueNode().setValue('xyz2').setDescription('descriptionXyz2'),
      });

    const object = NodeToMapListOrValue.get(node, 'simple');
    expect(typeof object).toBe('object');

    const result = object as Record<string, unknown>;

    expect(result['name']).toEqual('nameA');
    expect(result['description']).toEqual('descriptionA');

    const type = result['type'] as Record<string, unknown>;
    expect(type).toBeDefined();
    expect(type['name']).toEqual('nameB');
    expect(type['description']).toEqual('descriptionB');

    expect(result['a']).toEqual('xyz1');
    expect(result['b']).toEqual('xyz2');
  });

  it('testContractsStandardStrategy', () => {
    const node = new BlueNode()
      .setName('Agreement')
      .setDescription('Legal agreement')
      .setContracts({
        party1: new BlueNode().setName('Alice').setProperties({
          role: new BlueNode().setValue('Seller'),
        }),
        party2: new BlueNode().setName('Bob').setProperties({
          role: new BlueNode().setValue('Buyer'),
          contactInfo: new BlueNode().setValue('bob@example.com'),
        }),
        terms: new BlueNode().setItems([
          new BlueNode().setValue('Term 1'),
          new BlueNode().setValue('Term 2'),
        ]),
      });

    const object = NodeToMapListOrValue.get(node);
    expect(typeof object).toBe('object');

    const result = object as Record<string, unknown>;
    expect(result['name']).toEqual('Agreement');
    expect(result['description']).toEqual('Legal agreement');

    const contracts = result['contracts'] as Record<string, unknown>;
    expect(contracts).toBeDefined();

    const party1 = contracts['party1'] as Record<string, unknown>;
    expect(party1).toBeDefined();
    expect(party1['name']).toEqual('Alice');
    expect((party1['role'] as Record<string, unknown>)['value']).toEqual(
      'Seller'
    );

    const party2 = contracts['party2'] as Record<string, unknown>;
    expect(party2).toBeDefined();
    expect(party2['name']).toEqual('Bob');
    expect((party2['role'] as Record<string, unknown>)['value']).toEqual(
      'Buyer'
    );
    expect((party2['contactInfo'] as Record<string, unknown>)['value']).toEqual(
      'bob@example.com'
    );

    const terms = contracts['terms'] as Record<string, unknown>;
    expect(terms).toBeDefined();
    const termsItems = terms['items'] as Record<string, unknown>[];
    expect(termsItems).toBeDefined();
    expect(termsItems.length).toEqual(2);
    expect(termsItems[0]['value']).toEqual('Term 1');
    expect(termsItems[1]['value']).toEqual('Term 2');
  });

  it('testContractsSimpleStrategy', () => {
    const node = new BlueNode()
      .setName('Agreement')
      .setDescription('Legal agreement')
      .setContracts({
        party1: new BlueNode().setName('Alice').setProperties({
          role: new BlueNode().setValue('Seller'),
        }),
        party2: new BlueNode().setName('Bob').setProperties({
          role: new BlueNode().setValue('Buyer'),
          contactInfo: new BlueNode().setValue('bob@example.com'),
        }),
        terms: new BlueNode().setItems([
          new BlueNode().setValue('Term 1'),
          new BlueNode().setValue('Term 2'),
        ]),
      });

    const object = NodeToMapListOrValue.get(node, 'simple');
    expect(typeof object).toBe('object');

    const result = object as Record<string, unknown>;
    expect(result['name']).toEqual('Agreement');
    expect(result['description']).toEqual('Legal agreement');

    const contracts = result['contracts'] as Record<string, unknown>;
    expect(contracts).toBeDefined();

    const party1 = contracts['party1'] as Record<string, unknown>;
    expect(party1).toBeDefined();
    expect(party1['name']).toEqual('Alice');
    expect(party1['role']).toEqual('Seller');

    const party2 = contracts['party2'] as Record<string, unknown>;
    expect(party2).toBeDefined();
    expect(party2['name']).toEqual('Bob');
    expect(party2['role']).toEqual('Buyer');
    expect(party2['contactInfo']).toEqual('bob@example.com');

    const terms = contracts['terms'] as string[];
    expect(terms).toBeDefined();
    expect(terms.length).toEqual(2);
    expect(terms[0]).toEqual('Term 1');
    expect(terms[1]).toEqual('Term 2');
  });

  it('testListStandardStrategy', () => {
    const node = new BlueNode()
      .setName('nameA')
      .setDescription('descriptionA')
      .setItems([
        new BlueNode().setName('el1'),
        new BlueNode().setValue('value1'),
        new BlueNode().setItems([
          new BlueNode().setValue('x1'),
          new BlueNode().setValue('x2'),
        ]),
        new BlueNode().setItems([
          new BlueNode().setName('abc').setDescription('abc').setValue('y1'),
          new BlueNode().setValue('y2'),
        ]),
      ]);

    const object = NodeToMapListOrValue.get(node);
    expect(typeof object).toBe('object');

    const result = object as Record<string, unknown>;
    expect(result['name']).toEqual('nameA');
    expect(result['description']).toEqual('descriptionA');

    const items = result['items'] as Record<string, unknown>[];
    expect(items).toBeDefined();
    expect(items.length).toEqual(4);

    const item1 = items[0] as Record<string, unknown>;
    expect(item1['name']).toEqual('el1');
    expect(item1['value']).toBeUndefined();
    expect(item1['description']).toBeUndefined();
    expect(item1['items']).toBeUndefined();

    const item2 = items[1] as Record<string, unknown>;
    expect(item2['value']).toEqual('value1');
    expect(item2['name']).toBeUndefined();
    expect(item2['description']).toBeUndefined();
    expect(item2['items']).toBeUndefined();

    const item3 = items[2] as Record<string, unknown>;
    const nestedItems1 = item3['items'] as Record<string, unknown>[];
    expect(nestedItems1).toBeDefined();
    expect(nestedItems1.length).toEqual(2);
    expect(nestedItems1[0]['value']).toEqual('x1');
    expect(nestedItems1[1]['value']).toEqual('x2');

    const item4 = items[3] as Record<string, unknown>;
    const nestedItems2 = item4['items'] as Record<string, unknown>[];
    expect(nestedItems2).toBeDefined();
    expect(nestedItems2.length).toEqual(2);
    expect(nestedItems2[0]['name']).toEqual('abc');
    expect(nestedItems2[0]['description']).toEqual('abc');
    expect(nestedItems2[0]['value']).toEqual('y1');
    expect(nestedItems2[1]['value']).toEqual('y2');
  });

  it('testListDomainMappingStrategy', () => {
    const node = new BlueNode()
      .setName('nameA')
      .setDescription('descriptionA')
      .setItems([
        new BlueNode().setName('el1'),
        new BlueNode().setValue('value1'),
        new BlueNode().setItems([
          new BlueNode().setValue('x1'),
          new BlueNode().setValue('x2'),
        ]),
        new BlueNode().setItems([
          new BlueNode().setName('abc').setDescription('abc').setValue('y1'),
          new BlueNode().setValue('y2'),
        ]),
      ]);

    const object = NodeToMapListOrValue.get(node, 'simple');
    expect(Array.isArray(object)).toBeTruthy();

    const result = object as JsonValue[];
    expect(result.length).toEqual(4);

    const item1 = result[0] as JsonObject;
    expect(item1['name']).toEqual('el1');

    const item2 = result[1] as JsonObject;
    expect(item2).toEqual('value1');

    const item3 = result[2] as JsonValue[];
    expect(item3.length).toEqual(2);
    expect(item3[0]).toEqual('x1');
    expect(item3[1]).toEqual('x2');

    const item4 = result[3] as JsonValue[];
    expect(item4.length).toEqual(2);
    expect(item4[0]).toEqual('y1');
    expect(item4[1]).toEqual('y2');
  });

  describe('additional', () => {
    it('should throw error if an imprecise conversion occurs on node value', () => {
      const node1 = new BlueNode().setValue(
        new BigDecimalNumber(
          '132452345234524739582739458723948572934875.132452345234524739582739458723948572934875'
        )
      );

      expect(NodeToMapListOrValue.get(node1)).toMatchInlineSnapshot(`
        {
          "type": {
            "blueId": "68ryJtnmui4j5rCZWUnkZ3DChtmEb7Z9F8atn1mBSM3L",
          },
          "value": 1.3245234523452473e+41,
        }
      `);

      const node2 = new BlueNode().addProperty(
        'key',
        new BlueNode().setValue(
          new BigIntegerNumber('132452345234524739582739458723948572934875')
        )
      );

      expect(NodeToMapListOrValue.get(node2)).toMatchInlineSnapshot(`
        {
          "key": {
            "type": {
              "blueId": "DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8",
            },
            "value": "132452345234524739582739458723948572934875",
          },
        }
      `);
    });

    it('should return simplified object with blueId on nested level', () => {
      const node1 = NodeDeserializer.deserialize({
        description: 'Creamy risotto with porcini mushrooms.',
        image: {
          description: 'Image of Risotto al Funghi Porcini',
          value: '/images/risotto-porcini.webp',
        },
        name: 'Risotto al Funghi Porcini',
        price: {
          value: 16,
        },
      });

      const object1 = NodeToMapListOrValue.get(node1, 'simple');
      expect(object1).toMatchInlineSnapshot(`
        {
          "description": "Creamy risotto with porcini mushrooms.",
          "image": "/images/risotto-porcini.webp",
          "name": "Risotto al Funghi Porcini",
          "price": 16,
        }
      `);

      const node2 = NodeDeserializer.deserialize({
        name: 'nameA',
        description: 'descriptionA',
        property1: {
          name: 'nameB',
          subProperty: {
            blueId: '2RFx2oVzzuDJFVoagK5rohbCkFFA5SBp8WPmuyQ56UV6',
          },
        },
        property2: {
          name: 'nameC',
          value: 3,
        },
      });

      const object2 = NodeToMapListOrValue.get(node2, 'simple');
      expect(object2).toMatchInlineSnapshot(`
        {
          "description": "descriptionA",
          "name": "nameA",
          "property1": {
            "name": "nameB",
            "subProperty": {
              "blueId": "2RFx2oVzzuDJFVoagK5rohbCkFFA5SBp8WPmuyQ56UV6",
            },
          },
          "property2": 3,
        }
      `);

      const contractNode1 = NodeDeserializer.deserialize({
        name: 'nameA',
        description: 'descriptionA',
        participants: {
          description: 'participants part',
        },
      });

      const contract1 = NodeToMapListOrValue.get(contractNode1, 'simple');
      expect(contract1).toMatchInlineSnapshot(`
        {
          "description": "descriptionA",
          "name": "nameA",
          "participants": {
            "description": "participants part",
          },
        }
      `);

      const contractNode2 = NodeDeserializer.deserialize({
        name: 'nameA',
        description: 'descriptionA',
        participants: {
          description: 'participants part',
          items: ['Alice', 'Bob'],
        },
      });

      const contract2 = NodeToMapListOrValue.get(contractNode2, 'simple');
      expect(contract2).toMatchInlineSnapshot(`
        {
          "description": "descriptionA",
          "name": "nameA",
          "participants": [
            "Alice",
            "Bob",
          ],
        }
      `);
    });

    it('should properly serialize BlueNode with contracts', () => {
      const node = NodeDeserializer.deserialize({
        name: 'Contract',
        description: 'Main contract',
        mainRegistrationNumber: {
          description: 'Address',
          value: '123 Main St, Anytown, USA',
        },
        mainCountry: 'US',
        contracts: {
          timelineCh: {
            type: 'Timeline Channel',
            timelineId: 'user-123',
          },
          childWf: {
            type: 'Sequential Workflow',
            channel: 'timelineCh',
            steps: [
              {
                type: 'Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/mainRegistrationNumber/value',
                    val: '12345',
                  },
                ],
              },
            ],
          },
        },
      });

      // Test official strategy
      const officialResult = NodeToMapListOrValue.get(node);
      expect(officialResult).toMatchInlineSnapshot(`
        {
          "contracts": {
            "childWf": {
              "channel": {
                "type": {
                  "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
                },
                "value": "timelineCh",
              },
              "steps": {
                "items": [
                  {
                    "changeset": {
                      "items": [
                        {
                          "op": {
                            "type": {
                              "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
                            },
                            "value": "replace",
                          },
                          "path": {
                            "type": {
                              "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
                            },
                            "value": "/mainRegistrationNumber/value",
                          },
                          "val": {
                            "type": {
                              "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
                            },
                            "value": "12345",
                          },
                        },
                      ],
                    },
                    "type": {
                      "type": {
                        "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
                      },
                      "value": "Update Document",
                    },
                  },
                ],
              },
              "type": {
                "type": {
                  "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
                },
                "value": "Sequential Workflow",
              },
            },
            "timelineCh": {
              "timelineId": {
                "type": {
                  "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
                },
                "value": "user-123",
              },
              "type": {
                "type": {
                  "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
                },
                "value": "Timeline Channel",
              },
            },
          },
          "description": "Main contract",
          "mainCountry": {
            "type": {
              "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
            },
            "value": "US",
          },
          "mainRegistrationNumber": {
            "description": "Address",
            "type": {
              "blueId": "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP",
            },
            "value": "123 Main St, Anytown, USA",
          },
          "name": "Contract",
        }
      `);

      // Test simple strategy
      const simpleResult = NodeToMapListOrValue.get(node, 'simple');
      expect(simpleResult).toMatchInlineSnapshot(`
        {
          "contracts": {
            "childWf": {
              "channel": "timelineCh",
              "steps": [
                {
                  "changeset": [
                    {
                      "op": "replace",
                      "path": "/mainRegistrationNumber/value",
                      "val": "12345",
                    },
                  ],
                  "type": "Update Document",
                },
              ],
              "type": "Sequential Workflow",
            },
            "timelineCh": {
              "timelineId": "user-123",
              "type": "Timeline Channel",
            },
          },
          "description": "Main contract",
          "mainCountry": "US",
          "mainRegistrationNumber": "123 Main St, Anytown, USA",
          "name": "Contract",
        }
      `);
    });
  });

  describe('original strategy', () => {
    it('should return simple value when node has no name or description', () => {
      const node = NodeDeserializer.deserialize({
        value: 'simple value',
      });

      const result = NodeToMapListOrValue.get(node, 'original');
      expect(result).toEqual('simple value');
    });

    it('should return simple array when node has items but no name or description', () => {
      const node = NodeDeserializer.deserialize({
        items: ['item1', 'item2', 'item3'],
      });

      const result = NodeToMapListOrValue.get(node, 'original');
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    it('should return full object when node has name', () => {
      const node = NodeDeserializer.deserialize({
        name: 'Product',
        value: 'Laptop Computer',
      });

      const result = NodeToMapListOrValue.get(node, 'original');
      expect(typeof result).toBe('object');

      const obj = result as Record<string, unknown>;
      expect(obj['name']).toEqual('Product');
      expect(obj['value']).toEqual('Laptop Computer');
    });

    it('should return full object when node has description', () => {
      const node = NodeDeserializer.deserialize({
        description: 'A high-performance laptop',
        value: 'MacBook Pro',
      });

      const result = NodeToMapListOrValue.get(node, 'original');
      expect(typeof result).toBe('object');

      const obj = result as Record<string, unknown>;
      expect(obj['description']).toEqual('A high-performance laptop');
      expect(obj['value']).toEqual('MacBook Pro');
    });

    it('should handle mixed metadata in nested structures', () => {
      const node = NodeDeserializer.deserialize({
        name: 'Menu',
        description: 'Restaurant menu',
        items: [
          'Simple Item',
          {
            name: 'Named Item',
            price: 10.99,
          },
          {
            value: 'Value Item',
          },
        ],
        simpleProperty: 'just a value',
        namedProperty: {
          name: 'Complex Item',
          details: 'some details',
        },
      });

      const result = NodeToMapListOrValue.get(node, 'original') as Record<
        string,
        unknown
      >;

      expect(result['name']).toEqual('Menu');
      expect(result['description']).toEqual('Restaurant menu');

      const items = result['items'] as any[];
      expect(items[0]).toEqual('Simple Item');
      expect(items[1]).toEqual({ name: 'Named Item', price: 10.99 });
      expect(items[2]).toEqual('Value Item');

      expect(result['simpleProperty']).toEqual('just a value');
      expect(result['namedProperty']).toEqual({
        name: 'Complex Item',
        details: 'some details',
      });
    });

    it('should handle contracts with original strategy', () => {
      const node = NodeDeserializer.deserialize({
        name: 'Agreement',
        description: 'Legal agreement',
        contracts: {
          simpleParty: 'Party Name',
          namedParty: {
            name: 'Alice',
            role: 'Seller',
          },
        },
      });

      const result = NodeToMapListOrValue.get(node, 'original') as Record<
        string,
        unknown
      >;

      expect(result['name']).toEqual('Agreement');
      expect(result['description']).toEqual('Legal agreement');

      const contracts = result['contracts'] as Record<string, unknown>;
      expect(contracts['simpleParty']).toEqual('Party Name');
      expect(contracts['namedParty']).toEqual({
        name: 'Alice',
        role: 'Seller',
      });
    });

    it('should handle primitive types correctly', () => {
      const stringNode = NodeDeserializer.deserialize('Hello World');
      const numberNode = NodeDeserializer.deserialize(42);
      const booleanNode = NodeDeserializer.deserialize(true);
      const arrayNode = NodeDeserializer.deserialize([1, 2, 3]);

      expect(NodeToMapListOrValue.get(stringNode, 'original')).toEqual(
        'Hello World'
      );
      expect(NodeToMapListOrValue.get(numberNode, 'original')).toEqual(42);
      expect(NodeToMapListOrValue.get(booleanNode, 'original')).toEqual(true);
      expect(NodeToMapListOrValue.get(arrayNode, 'original')).toEqual([
        1, 2, 3,
      ]);
    });

    it('should compare strategies on same data', () => {
      const node = NodeDeserializer.deserialize({
        name: 'Test Item',
        value: 'test value',
        simple: 'just text',
        complex: {
          name: 'Complex Property',
          value: 'complex value',
        },
      });

      const official = NodeToMapListOrValue.get(node, 'official') as Record<
        string,
        unknown
      >;
      const simple = NodeToMapListOrValue.get(node, 'simple') as Record<
        string,
        unknown
      >;
      const original = NodeToMapListOrValue.get(node, 'original') as Record<
        string,
        unknown
      >;

      expect(official['value']).toBe('test value');
      expect(simple).toBe('test value');
      expect(original['value']).toBe('test value');

      expect(official['name']).toEqual('Test Item');
      expect(simple?.['name']).toBeUndefined();
      expect(original['name']).toEqual('Test Item');

      expect(typeof official['simple']).toBe('object');
      expect(simple?.['simple']).toBeUndefined();
      expect(original['simple']).toEqual('just text');

      expect(typeof official['complex']).toBe('object');
      expect(simple?.['complex']).toBeUndefined();
      expect(typeof original['complex']).toBe('object');
      expect((original['complex'] as any)['name']).toEqual('Complex Property');
    });
  });
});
