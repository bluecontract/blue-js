import { describe, it, expect } from 'vitest';
import {
  applyBlueNodePatch,
  applyBlueNodePatches,
  BlueNodePatch,
} from '../NodePatch';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { BlueNode } from '../../model/Node';

describe('NodePatch Edge Cases and Array Access Patterns', () => {
  describe('Array Access Pattern Tests', () => {
    it('should support both /list/0 and /list/items/0 patterns', () => {
      const node = NodeDeserializer.deserialize({
        list: ['a', 'b', 'c'],
      });
      let currentDoc = node;

      // Test direct index access on property
      const patch1: BlueNodePatch = {
        op: 'replace',
        path: '/list/0/value',
        val: 'A',
      };
      currentDoc = applyBlueNodePatch(currentDoc, patch1);
      expect(currentDoc.get('/list/0/value')).toBe('A');

      // Test with explicit items path
      // Note: applyBlueNodePatch creates clones by default, so re-initialize for isolated tests or use original 'node'
      const patch2: BlueNodePatch = {
        op: 'replace',
        path: '/list/items/1/value',
        val: 'B',
      };
      currentDoc = applyBlueNodePatch(node.clone(), patch2); // Use a fresh clone for this part of the test
      expect(currentDoc.get('/list/1/value')).toBe('B');

      // Both should work on the same array - use applyBlueNodePatches for sequence
      const patches3: BlueNodePatch[] = [
        { op: 'replace', path: '/list/0/value', val: 'X' },
        { op: 'replace', path: '/list/items/2/value', val: 'Z' },
      ];
      const result3 = applyBlueNodePatches(node.clone(), patches3); // Use applyBlueNodePatches and a fresh clone
      expect(result3.get('/list/0/value')).toBe('X');
      expect(result3.get('/list/2/value')).toBe('Z');
    });

    it('should handle root-level array access without /items', () => {
      const node = NodeDeserializer.deserialize(['x', 'y', 'z']);
      const patchesArray: BlueNodePatch[] = [
        { op: 'replace', path: '/0/value', val: 'X' },
        { op: 'replace', path: '/1/value', val: 'Y' },
        { op: 'remove', path: '/2' },
      ];
      const result = applyBlueNodePatches(node, patchesArray);
      expect(result.getItems()?.length).toBe(2);
      expect(result.getItems()?.[0].getValue()).toBe('X');
      expect(result.getItems()?.[1].getValue()).toBe('Y');
    });

    it('should handle mixed object and array structures', () => {
      const node = NodeDeserializer.deserialize({
        data: {
          items: ['a', 'b'],
          metadata: { count: 2 },
        },
        list: [{ items: ['x', 'y'] }, { items: ['z'] }],
      });
      const patchesArray: BlueNodePatch[] = [
        { op: 'add', path: '/data/items/-', val: 'c' },
        { op: 'add', path: '/list/0/items/-', val: 'w' },
        { op: 'replace', path: '/list/1/items/0/value', val: 'Z' },
      ];

      const result = applyBlueNodePatches(node, patchesArray);
      expect((result.get('/data/items') as BlueNode).getItems()?.length).toBe(
        3
      );
      expect((result.get('/list/0/items') as BlueNode).getItems()?.length).toBe(
        3
      );
      expect(result.get('/list/1/items/0/value')).toBe('Z');
    });

    it('should provide shorthand syntax for array access', () => {
      const node = NodeDeserializer.deserialize({
        todos: [
          { text: 'Buy milk', done: false },
          { text: 'Write tests', done: true },
        ],
      });
      const patchesArray: BlueNodePatch[] = [
        { op: 'replace', path: '/todos/0/done/value', val: true },
        { op: 'replace', path: '/todos/1/text/value', val: 'Write more tests' },
        { op: 'add', path: '/todos/-', val: { text: 'Deploy', done: false } },
        {
          op: 'add',
          path: '/todos/items/-',
          val: { text: 'Celebrate', done: false },
        },
      ];
      const result = applyBlueNodePatches(node, patchesArray);
      const todos = result.getProperties()?.todos as BlueNode;
      expect(todos.getItems()?.[0].get('/done/value')).toBe(true);
      expect(todos.getItems()?.[1].get('/text/value')).toBe('Write more tests');
      expect(todos.getItems()?.length).toBe(4);
      expect(todos.getItems()?.[2].get('/text/value')).toBe('Deploy');
      expect(todos.getItems()?.[3].get('/text/value')).toBe('Celebrate');
    });
  });

  describe('Special Properties vs Regular Properties', () => {
    it('should distinguish between BlueNode special properties and user properties', () => {
      const node = NodeDeserializer.deserialize({
        name: 'NodeName',
        title: 'NodeTitle',
      });
      const patchesArray: BlueNodePatch[] = [
        { op: 'replace', path: '/name', val: 'UpdatedNodeName' },
        { op: 'replace', path: '/title/value', val: 'UpdatedTitle' },
        { op: 'add', path: '/newProp', val: 'NewValue' },
      ];
      const result = applyBlueNodePatches(node, patchesArray);
      expect(result.getName()).toBe('UpdatedNodeName');
      expect(result.getProperties()?.title.getValue()).toBe('UpdatedTitle');
      expect(result.getProperties()?.newProp.getValue()).toBe('NewValue');
    });

    it('should handle user properties with names conflicting with BlueNode special properties', () => {
      const node = NodeDeserializer.deserialize({
        type: { blueId: 'actual-type' },
        items: ['x', 'y'],
        value: 'actual-value',
        myType: 'UserType',
        myItems: ['a', 'b'],
        myValue: 'UserValue',
        myContracts: { c1: {} },
      });
      const patchesArray: BlueNodePatch[] = [
        { op: 'replace', path: '/type/blueId', val: 'new-type' },
        { op: 'add', path: '/items/-', val: 'z' },
        { op: 'replace', path: '/value', val: 'new-value' },
        { op: 'replace', path: '/myType/value', val: 'NewUserType' },
        { op: 'add', path: '/myItems/-', val: 'c' },
        { op: 'replace', path: '/myValue/value', val: 'NewUserValue' },
      ];
      const result = applyBlueNodePatches(node, patchesArray);
      expect(result.getType()?.getBlueId()).toBe('new-type');
      expect(result.getItems()?.length).toBe(3);
      expect(result.getValue()).toBe('new-value');
      expect(result.getProperties()?.myType.getValue()).toBe('NewUserType');
      expect(
        (result.getProperties()?.myItems as BlueNode).getItems()?.length
      ).toBe(3);
      expect(result.getProperties()?.myValue.getValue()).toBe('NewUserValue');
    });
  });

  describe('Complex Nested Operations', () => {
    it('should handle deeply nested array of arrays', () => {
      const node = NodeDeserializer.deserialize({
        matrix3d: [
          [
            [1, 2],
            [3, 4],
          ],
          [
            [5, 6],
            [7, 8],
          ],
        ],
      });
      const patchesArray: BlueNodePatch[] = [
        { op: 'replace', path: '/matrix3d/0/0/1/value', val: 22 },
        { op: 'add', path: '/matrix3d/1/1/-', val: 9 },
        { op: 'add', path: '/matrix3d/0/-', val: [10, 11] },
        { op: 'remove', path: '/matrix3d/1/0/0' },
      ];
      const result = applyBlueNodePatches(node, patchesArray);
      const matrix = result.get('/matrix3d') as BlueNode;
      expect(
        matrix
          .getItems()?.[0]
          .getItems()?.[0]
          .getItems()?.[1]
          .getValue()
          ?.toString()
      ).toBe('22');
      expect(matrix.getItems()?.[1].getItems()?.[1].getItems()?.length).toBe(3);
      expect(matrix.getItems()?.[0].getItems()?.length).toBe(3);
      expect(matrix.getItems()?.[1].getItems()?.[0].getItems()?.length).toBe(1);
    });

    it('should handle circular-like references with copy operations', () => {
      const node = NodeDeserializer.deserialize({
        a: { data: 'original', ref: null },
        b: { data: 'other' },
      });
      const patchesArray: BlueNodePatch[] = [
        { op: 'copy', from: '/b', path: '/a/ref' },
        { op: 'replace', path: '/a/ref/data/value', val: 'modified' },
        { op: 'test', path: '/b/data/value', val: 'other' },
      ];
      const result = applyBlueNodePatches(node, patchesArray);
      expect(result.get('/a/ref/data/value')).toBe('modified');
      expect(result.get('/b/data/value')).toBe('other');
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle patches on non-existent array indices gracefully', () => {
      const node = NodeDeserializer.deserialize({
        list: ['a', 'b'],
      });
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/list/5/value',
        val: 'x',
      }; // Single patch
      expect(() => applyBlueNodePatch(node, patch)).toThrow(
        /Cannot resolve '\/list\/5'/
      );
    });
  });

  describe('Type Conversions and Coercions', () => {
    it('should handle type changes on values', () => {
      const node = NodeDeserializer.deserialize({
        strVal: 'hello',
        numVal: 42,
        boolVal: true,
        nullVal: null,
      });
      const patchesArray: BlueNodePatch[] = [
        { op: 'replace', path: '/strVal', val: 123 },
        { op: 'replace', path: '/numVal', val: 'forty-two' },
        { op: 'replace', path: '/boolVal', val: null },
        { op: 'replace', path: '/nullVal', val: false },
      ];
      const result = applyBlueNodePatches(node, patchesArray);
      expect(typeof result.get('/strVal/value')).toBe('object');
      expect(result.get('/strVal/value')?.toString()).toBe('123');
      expect(result.get('/numVal/value')).toBe('forty-two');
      expect(result.get('/boolVal/value')).toBe(null);
      expect(result.get('/nullVal/value')).toBe(false);
    });

    it('should preserve BigNumber types', () => {
      const node = NodeDeserializer.deserialize({
        bigInt: '99999999999999999999999999999',
        bigDecimal: '3.141592653589793238462643383279502884197',
      });
      const patchesArray: BlueNodePatch[] = [
        { op: 'copy', from: '/bigInt', path: '/bigIntCopy' },
        { op: 'copy', from: '/bigDecimal', path: '/bigDecimalCopy' },
        { op: 'move', from: '/bigInt', path: '/bigIntMoved' },
      ];
      const result = applyBlueNodePatches(node, patchesArray);
      expect(result.get('/bigIntCopy/value')?.toString()).toBe(
        '99999999999999999999999999999'
      );
      expect(result.get('/bigDecimalCopy/value')?.toString()).toContain(
        '3.14159'
      );
      expect(result.get('/bigIntMoved/value')?.toString()).toBe(
        '99999999999999999999999999999'
      );
      expect(result.get('/bigInt')).toBeUndefined();
    });
  });

  describe('Batch Operations', () => {
    it('should handle large batch of operations efficiently', () => {
      const node = NodeDeserializer.deserialize({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          value: `item${i}`,
        })),
      });
      const patchesArray: BlueNodePatch[] = [];
      for (let i = 0; i < 100; i += 10) {
        patchesArray.push({
          op: 'replace',
          path: `/items/${i}/value`,
          val: `updated${i}`,
        });
      }
      for (let i = 75; i >= 0; i -= 25) {
        patchesArray.push({
          op: 'remove',
          path: `/items/${i}`,
        });
      }
      for (let i = 0; i < 5; i++) {
        patchesArray.push({
          op: 'add',
          path: '/items/-',
          val: { id: 100 + i, value: `new${i}` },
        });
      }
      const result = applyBlueNodePatches(node, patchesArray);
      const items = result.getItems();
      expect(items?.length).toBe(101);
      const item10 = items?.find(
        (item) => item.get('/id/value')?.toString() === '10'
      );
      expect(item10?.getValue()).toBe('updated10');
      const item25 = items?.find(
        (item) => item.get('/id/value')?.toString() === '25'
      );
      expect(item25).toBeUndefined();
      const newItem = items?.find(
        (item) => item.get('/id/value')?.toString() === '100'
      );
      expect(newItem?.getValue()).toBe('new0');
    });
  });

  describe('Blue and Transformation Operations', () => {
    it('should handle operations on blue transformations', () => {
      const node = NodeDeserializer.deserialize({
        name: 'Document',
        blue: [
          { type: { blueId: 'transform1' }, config: { param: 'value1' } },
          { type: { blueId: 'transform2' }, config: { param: 'value2' } },
        ],
      });
      const patchesArray: BlueNodePatch[] = [
        {
          op: 'replace',
          path: '/blue/0/config/param/value',
          val: 'updatedValue1',
        },
        {
          op: 'add',
          path: '/blue/1',
          val: {
            type: { blueId: 'transform1.5' },
            config: { param: 'value1.5' },
          },
        },
        { op: 'move', from: '/blue/0', path: '/blue/-' },
      ];
      const result = applyBlueNodePatches(node, patchesArray);
      const blueItems = result.getBlue()?.getItems();
      expect(blueItems?.length).toBe(3);
      expect(blueItems?.[0].getType()?.getBlueId()).toBe('transform1.5');
      expect(blueItems?.[1].getType()?.getBlueId()).toBe('transform2');
      expect(blueItems?.[2].getType()?.getBlueId()).toBe('transform1');
      expect(blueItems?.[2].get('/config/param/value')).toBe('updatedValue1');
    });
  });
});
