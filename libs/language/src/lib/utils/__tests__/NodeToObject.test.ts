import { JsonObject, JsonValue } from 'type-fest';
import { BlueNode } from '../../model/Node';
import { NodeToObject } from '../NodeToObject';
import Big from 'big.js';

describe('NodeToObject', () => {
  it('testBasicStandardStrategy', () => {
    const node = new BlueNode()
      .setName('nameA')
      .setDescription('descriptionA')
      .setType(new BlueNode().setName('nameB').setDescription('descriptionB'))
      .setProperties({
        a: new BlueNode().setValue('xyz1'),
        b: new BlueNode().setValue('xyz2').setDescription('descriptionXyz2'),
      });

    const object = NodeToObject.get(node);
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

    const object = NodeToObject.get(node, 'domainMapping');
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

    const object = NodeToObject.get(node);
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

    const object = NodeToObject.get(node, 'domainMapping');
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
      const errorSnapshot = `[Error: [big.js] Imprecise conversion]`;
      const node1 = new BlueNode().setValue(
        new Big(
          '132452345234524739582739458723948572934875.132452345234524739582739458723948572934875'
        )
      );

      expect(() => NodeToObject.get(node1)).toThrowErrorMatchingInlineSnapshot(
        errorSnapshot
      );

      const node2 = new BlueNode().addProperty(
        'key',
        new BlueNode().setValue(
          new Big('132452345234524739582739458723948572934875')
        )
      );

      expect(() => NodeToObject.get(node2)).toThrowErrorMatchingInlineSnapshot(
        errorSnapshot
      );

      const node3 = new BlueNode().addItems(
        new BlueNode().setValue(
          new Big('132452345234524739582739458723948572934875')
        )
      );

      expect(() => NodeToObject.get(node3)).toThrowErrorMatchingInlineSnapshot(
        errorSnapshot
      );
    });
  });
});
