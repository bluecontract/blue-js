import { describe, it, expect } from 'vitest';
import {
  applyBlueNodePatch,
  applyBlueNodePatches,
  BlueNodePatch,
} from '../NodePatch';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { BlueNode } from '../../model/Node';
import { BigIntegerNumber } from '../../model/BigIntegerNumber';
import { BigDecimalNumber } from '../../model/BigDecimalNumber';

describe('NodePatch Comprehensive Tests', () => {
  describe('Basic Property Operations', () => {
    function createTestNode(): BlueNode {
      return NodeDeserializer.deserialize({
        name: 'TestNode',
        description: 'A test node',
        blueId: 'test-blue-id-123',
        value: 'test-value',
        type: { blueId: 'type-123' },
        itemType: { blueId: 'item-type-123' },
        keyType: { blueId: 'key-type-123' },
        valueType: { blueId: 'value-type-123' },
      });
    }

    it('should patch name property', () => {
      const node = createTestNode();
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/name',
        val: 'UpdatedName',
      };
      const result = applyBlueNodePatch(node, patch);
      expect(result.getName()).toBe('UpdatedName');
    });

    it('should patch description property', () => {
      const node = createTestNode();
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/description',
        val: 'Updated description',
      };
      const result = applyBlueNodePatch(node, patch);
      expect(result.getDescription()).toBe('Updated description');
    });

    it('should patch blueId property', () => {
      const node = createTestNode();
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/blueId',
        val: 'new-blue-id-456',
      };
      const result = applyBlueNodePatch(node, patch);
      expect(result.getBlueId()).toBe('new-blue-id-456');
    });

    it('should remove properties', () => {
      const node = createTestNode();
      const patches: BlueNodePatch[] = [
        { op: 'remove', path: '/name' },
        { op: 'remove', path: '/description' },
        { op: 'remove', path: '/blueId' },
      ];
      const result = applyBlueNodePatches(node, patches);
      expect(result.getName()).toBeUndefined();
      expect(result.getDescription()).toBeUndefined();
      expect(result.getBlueId()).toBeUndefined();
    });
  });

  describe('Type Properties Operations', () => {
    it('should patch type, itemType, keyType, valueType', () => {
      const node = NodeDeserializer.deserialize({
        name: 'TypeTest',
        type: { blueId: 'old-type' },
        itemType: { blueId: 'old-item-type' },
        keyType: { blueId: 'old-key-type' },
        valueType: { blueId: 'old-value-type' },
      });

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/type', val: { blueId: 'new-type' } },
        { op: 'replace', path: '/itemType', val: { blueId: 'new-item-type' } },
        { op: 'replace', path: '/keyType', val: { blueId: 'new-key-type' } },
        {
          op: 'replace',
          path: '/valueType',
          val: { blueId: 'new-value-type' },
        },
      ];

      const result = applyBlueNodePatches(node, patches);
      expect(result.getType()?.getBlueId()).toBe('new-type');
      expect(result.getItemType()?.getBlueId()).toBe('new-item-type');
      expect(result.getKeyType()?.getBlueId()).toBe('new-key-type');
      expect(result.getValueType()?.getBlueId()).toBe('new-value-type');
    });

    it('should patch nested properties within type nodes', () => {
      const node = NodeDeserializer.deserialize({
        type: {
          name: 'TypeName',
          blueId: 'type-id',
          prop1: 'value1',
        },
      });

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/type/name', val: 'UpdatedTypeName' },
        { op: 'add', path: '/type/prop2', val: 'value2' },
      ];

      const result = applyBlueNodePatches(node, patches);
      expect(result.getType()?.getName()).toBe('UpdatedTypeName');
      expect(result.getType()?.getProperties()?.prop2.getValue()).toBe(
        'value2',
      );
    });
  });

  describe('Value Operations', () => {
    it('should patch primitive values', () => {
      const node = NodeDeserializer.deserialize({ value: 'old-value' });
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/value',
        val: 'new-value',
      };
      const result = applyBlueNodePatch(node, patch);
      expect(result.getValue()).toBe('new-value');
    });

    it('should patch numeric values', () => {
      const node = NodeDeserializer.deserialize({ value: 42 });
      const patch: BlueNodePatch = { op: 'replace', path: '/value', val: 100 };
      const result = applyBlueNodePatch(node, patch);
      expect(result.getValue()).toBeInstanceOf(BigIntegerNumber);
      expect(result.getValue()?.toString()).toBe('100');
    });

    it('should patch decimal values', () => {
      const node = NodeDeserializer.deserialize({ value: 3.14 });
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/value',
        val: 2.718,
      };
      const result = applyBlueNodePatch(node, patch);
      expect(result.getValue()).toBeInstanceOf(BigDecimalNumber);
      expect(result.getValue()?.toString()).toBe('2.718');
    });

    it('should patch boolean values', () => {
      const node = NodeDeserializer.deserialize({ value: true });
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/value',
        val: false,
      };
      const result = applyBlueNodePatch(node, patch);
      expect(result.getValue()).toBe(false);
    });

    it('should handle null values', () => {
      const node = NodeDeserializer.deserialize({ value: 'something' });
      const patch: BlueNodePatch = { op: 'replace', path: '/value', val: null };
      const result = applyBlueNodePatch(node, patch);
      expect(result.getValue()).toBe(null);
    });
  });

  describe('Array/Items Operations', () => {
    function createArrayNode(): BlueNode {
      return NodeDeserializer.deserialize({
        list: [
          { name: 'item0', value: 'zero' },
          { name: 'item1', value: 'one' },
          { name: 'item2', value: 'two' },
        ],
      });
    }

    it('should support direct array index access without /items', () => {
      const node = createArrayNode();
      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/list/0/value', val: 'ZERO' },
        { op: 'replace', path: '/list/1/name', val: 'ITEM1' },
      ];

      const result = applyBlueNodePatches(node, patches);
      const listItemsNodes = result.getProperties()?.list?.getItems();
      expect(listItemsNodes?.[0].getValue()).toBe('ZERO');
      expect(listItemsNodes?.[1].getName()).toBe('ITEM1');
    });

    it('should also support /items/ syntax for arrays', () => {
      const node = createArrayNode();
      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/list/items/0/value', val: 'ZERO' },
        { op: 'replace', path: '/list/items/1/name', val: 'ITEM1' },
      ];
      const result = applyBlueNodePatches(node, patches);
      const listItemsNodes = result.getProperties()?.list?.getItems();
      expect(listItemsNodes?.[0].getValue()).toBe('ZERO');
      expect(listItemsNodes?.[1].getName()).toBe('ITEM1');
    });

    it('should add items at specific indices', () => {
      const node = createArrayNode();
      const patch: BlueNodePatch = {
        op: 'add',
        path: '/list/1',
        val: { name: 'inserted', value: 'new' },
      };
      const result = applyBlueNodePatch(node, patch);
      const listItemsNodes = result.getProperties()?.list?.getItems();
      expect(listItemsNodes?.length).toBe(4);
      expect(listItemsNodes?.[1].getName()).toBe('inserted');
      expect(listItemsNodes?.[2].getName()).toBe('item1'); // shifted
    });

    it('should add items at end with "-" index', () => {
      const node = createArrayNode();
      const patches: BlueNodePatch[] = [
        { op: 'add', path: '/list/-', val: { name: 'item3', value: 'three' } },
        {
          op: 'add',
          path: '/list/items/-',
          val: { name: 'item4', value: 'four' },
        },
      ];
      const result = applyBlueNodePatches(node, patches);
      const listItemsNodes = result.getProperties()?.list?.getItems();

      expect(listItemsNodes?.length).toBe(5);
      expect(listItemsNodes?.[3].getName()).toBe('item3');
      expect(listItemsNodes?.[4].getName()).toBe('item4');
    });

    it('should throw error when adding to array at index > length', () => {
      const node = createArrayNode(); // list: [item0, item1, item2] (length 3)
      const patch: BlueNodePatch = {
        op: 'add',
        path: '/list/4',
        val: { name: 'item4', value: 'four' },
      };
      expect(() => applyBlueNodePatch(node, patch)).toThrow(
        /ADD operation failed: Target array index '4' is greater than array length 3/,
      );
    });

    it('should remove items by index', () => {
      const node = createArrayNode();
      const patches: BlueNodePatch[] = [
        { op: 'remove', path: '/list/1' },
        { op: 'remove', path: '/list/items/0' }, // now removes what was originally at index 2
      ];
      const result = applyBlueNodePatches(node, patches);
      const listItemsNodes = result.getProperties()?.list?.getItems();

      expect(listItemsNodes?.length).toBe(1);
      expect(listItemsNodes?.[0].getName()).toBe('item2');
    });

    it('should move items within array', () => {
      const node = createArrayNode();
      const patch: BlueNodePatch = {
        op: 'move',
        from: '/list/0',
        path: '/list/2',
      };
      const result = applyBlueNodePatch(node, patch);
      const listItemsNodes = result.getProperties()?.list?.getItems();

      expect(listItemsNodes?.[0].getName()).toBe('item1');
      expect(listItemsNodes?.[1].getName()).toBe('item2');
      expect(listItemsNodes?.[2].getName()).toBe('item0');
    });

    it('should handle nested arrays', () => {
      const node = NodeDeserializer.deserialize({
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });
      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/matrix/0/1/value', val: 22 },
        { op: 'add', path: '/matrix/1/-', val: 7 },
      ];
      const result = applyBlueNodePatches(node, patches);
      const matrix = result.get('/matrix') as BlueNode;
      expect(
        matrix.getItems()?.[0].getItems()?.[1].getValue()?.toString(),
      ).toBe('22');
      expect(matrix.getItems()?.[1].getItems()?.length).toBe(4);
    });

    it('should handle arrays as user properties with direct index access', () => {
      const node = NodeDeserializer.deserialize({
        name: 'Parent',
        myList: ['a', 'b', 'c'],
        nestedData: {
          innerList: [1, 2, 3],
        },
      });

      const patches: BlueNodePatch[] = [
        // Direct access to array elements in user properties
        { op: 'replace', path: '/myList/0/value', val: 'A' },
        { op: 'add', path: '/myList/-', val: 'd' },
        { op: 'remove', path: '/myList/1' },

        // Nested array access
        { op: 'replace', path: '/nestedData/innerList/2/value', val: 33 },
      ];

      const result = applyBlueNodePatches(node, patches);
      const myList = result.getProperties()?.myList as BlueNode;
      expect(myList.getItems()?.length).toBe(3); // was 3, removed 1, added 1
      expect(myList.getItems()?.[0].getValue()).toBe('A');
      expect(myList.getItems()?.[1].getValue()).toBe('c'); // shifted after removal
      expect(myList.getItems()?.[2].getValue()).toBe('d');

      const innerList = result.get('/nestedData/innerList') as BlueNode;
      expect(innerList.getItems()?.[2].getValue()?.toString()).toBe('33');
    });
  });

  describe('Properties Operations', () => {
    function createNodeWithProperties(): BlueNode {
      return NodeDeserializer.deserialize({
        name: 'Parent',
        prop1: { value: 'value1' },
        prop2: { value: 'value2' },
        nested: {
          subProp1: 'sub1',
          subProp2: 'sub2',
        },
      });
    }

    it('should add new properties', () => {
      const node = createNodeWithProperties();
      const patches: BlueNodePatch[] = [
        { op: 'add', path: '/properties/prop3', val: { value: 'value3' } },
        { op: 'add', path: '/prop4', val: { value: 'value4' } }, // direct property access
      ];
      const result = applyBlueNodePatches(node, patches);
      expect(result.getProperties()?.prop3.getValue()).toBe('value3');
      expect(result.getProperties()?.prop4.getValue()).toBe('value4');
    });

    it('should replace existing properties', () => {
      const node = createNodeWithProperties();
      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/prop1/value', val: 'updated1' },
        {
          op: 'replace',
          path: '/properties/prop2',
          val: { value: 'updated2' },
        },
      ];
      const result = applyBlueNodePatches(node, patches);
      expect(result.getProperties()?.prop1.getValue()).toBe('updated1');
      expect(result.getProperties()?.prop2.getValue()).toBe('updated2');
    });

    it('should remove properties', () => {
      const node = createNodeWithProperties();
      const patches: BlueNodePatch[] = [
        { op: 'remove', path: '/prop1' },
        { op: 'remove', path: '/properties/prop2' },
      ];
      const result = applyBlueNodePatches(node, patches);
      expect(result.getProperties()?.prop1).toBeUndefined();
      expect(result.getProperties()?.prop2).toBeUndefined();
      expect(result.getProperties()?.nested).toBeDefined();
    });

    it('should handle deeply nested property operations', () => {
      const node = createNodeWithProperties();
      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/nested/subProp1/value', val: 'updated-sub1' },
        { op: 'add', path: '/nested/properties/subProp3', val: 'sub3' },
        { op: 'remove', path: '/nested/subProp2' },
      ];
      const result = applyBlueNodePatches(node, patches);
      const nested = result.getProperties()?.nested;
      expect(nested?.getProperties()?.subProp1.getValue()).toBe('updated-sub1');
      expect(nested?.getProperties()?.subProp3.getValue()).toBe('sub3');
      expect(nested?.getProperties()?.subProp2).toBeUndefined();
    });

    it('should create intermediate properties with replace operation', () => {
      const node = NodeDeserializer.deserialize({ name: 'Test' });
      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/newProp', val: { value: 'new' } },
      ];
      const result = applyBlueNodePatches(node, patches);
      expect(result.getProperties()?.newProp.getValue()).toBe('new');
    });
  });

  describe('Contracts Operations', () => {
    function createNodeWithContracts(): BlueNode {
      return NodeDeserializer.deserialize({
        name: 'System',
        contracts: {
          contract1: {
            type: 'Timeline Channel',
            timelineId: 'timeline-1',
          },
          contract2: {
            type: 'Sequential Workflow',
            channel: 'contract1',
            steps: [],
          },
        },
      });
    }

    it('should add new contracts', () => {
      const node = createNodeWithContracts();
      const patch: BlueNodePatch = {
        op: 'add',
        path: '/contracts/contract3',
        val: {
          type: 'Embedded Node Channel',
          nodeId: 'node-123',
        },
      };

      const result = applyBlueNodePatch(node, patch);
      expect(result.getContracts()?.contract3).toBeDefined();
      expect(result.getContracts()?.contract3.get('/type/value')).toBe(
        'Embedded Node Channel',
      );
    });

    it('should replace contract properties', () => {
      const node = createNodeWithContracts();
      const patches: BlueNodePatch[] = [
        {
          op: 'replace',
          path: '/contracts/contract1/timelineId/value',
          val: 'timeline-2',
        },
        {
          op: 'replace',
          path: '/contracts/contract2/channel/value',
          val: 'contract3',
        },
      ];
      const result = applyBlueNodePatches(node, patches);
      expect(result.getContracts()?.contract1.get('/timelineId/value')).toBe(
        'timeline-2',
      );
      expect(result.getContracts()?.contract2.get('/channel/value')).toBe(
        'contract3',
      );
    });

    it('should remove contracts', () => {
      const node = createNodeWithContracts();
      const patch: BlueNodePatch = {
        op: 'remove',
        path: '/contracts/contract1',
      };
      const result = applyBlueNodePatch(node, patch);
      expect(result.getContracts()?.contract1).toBeUndefined();
      expect(result.getContracts()?.contract2).toBeDefined();
    });

    it('should add steps to workflow contract', () => {
      const node = createNodeWithContracts();
      const patch: BlueNodePatch = {
        op: 'add',
        path: '/contracts/contract2/steps/-',
        val: {
          type: 'Sequential Workflow Step',
          action: 'Process',
        },
      };

      const result = applyBlueNodePatch(node, patch);
      const steps = result.getContracts()?.contract2.get('/steps') as BlueNode;
      expect(steps.getItems()?.length).toBe(1);
      expect(steps.getItems()?.[0].get('/action/value')).toBe('Process');
    });
  });

  describe('Blue Property Operations', () => {
    it('should patch blue property', () => {
      const node = NodeDeserializer.deserialize({
        name: 'Document',
        blue: [
          { type: { blueId: 'transformation1' } },
          { type: { blueId: 'transformation2' } },
        ],
      });

      const patches: BlueNodePatch[] = [
        {
          op: 'add',
          path: '/blue/-',
          val: { type: { blueId: 'transformation3' } },
        },
        { op: 'remove', path: '/blue/0' },
      ];

      const result = applyBlueNodePatches(node, patches);
      const blueItems = result.getBlue()?.getItems();
      expect(blueItems?.length).toBe(2);
      expect(blueItems?.[0].getType()?.getBlueId()).toBe('transformation2');
      expect(blueItems?.[1].getType()?.getBlueId()).toBe('transformation3');
    });
  });

  describe('Copy and Move Operations', () => {
    it('should copy values between paths', () => {
      const node = NodeDeserializer.deserialize({
        source: { value: 'to-copy', nested: { data: 'nested-data' } },
        target: { value: 'will-be-overwritten' },
      });

      const patches: BlueNodePatch[] = [
        { op: 'copy', from: '/source', path: '/backup' },
        { op: 'copy', from: '/source/nested', path: '/target/nested' },
      ];

      const result = applyBlueNodePatches(node, patches);
      expect(result.get('/backup/value')).toBe('to-copy');
      expect(result.get('/backup/nested/data/value')).toBe('nested-data');
      expect(result.get('/target/nested/data/value')).toBe('nested-data');
      expect(result.get('/source/value')).toBe('to-copy'); // original unchanged
    });

    it('should move values between paths', () => {
      const node = NodeDeserializer.deserialize({
        oldLocation: { data: 'to-move', keep: 'this' },
        newLocation: {},
      });

      const patches: BlueNodePatch[] = [
        { op: 'move', from: '/oldLocation/data', path: '/newLocation/data' },
      ];

      const result = applyBlueNodePatches(node, patches);
      expect(result.get('/newLocation/data/value')).toBe('to-move');
      expect(result.get('/oldLocation/data')).toBeUndefined();
      expect(result.get('/oldLocation/keep/value')).toBe('this');
    });

    it('should move between arrays and objects', () => {
      const node = NodeDeserializer.deserialize({
        list: ['a', 'b', 'c'],
        obj: {},
      });

      const patches: BlueNodePatch[] = [
        { op: 'move', from: '/list/1', path: '/obj/extracted' },
      ];

      const result = applyBlueNodePatches(node, patches);
      expect(result.get('/obj/extracted/value')).toBe('b');
      expect((result.get('/list') as BlueNode)?.getItems()?.length).toBe(2);
      expect(result.get('/list/0/value')).toBe('a');
      expect(result.get('/list/1/value')).toBe('c');
    });
  });

  describe('Test Operations', () => {
    it('should pass test when values match', () => {
      const node = NodeDeserializer.deserialize({
        str: 'hello',
        num: 42,
        bool: true,
        obj: { nested: 'value' },
      });

      const patches: BlueNodePatch[] = [
        { op: 'test', path: '/str/value', val: 'hello' },
        { op: 'test', path: '/num/value', val: new BigIntegerNumber(42) },
        { op: 'test', path: '/bool/value', val: true },
        { op: 'test', path: '/obj/nested/value', val: 'value' },
      ];

      expect(() => applyBlueNodePatches(node, patches)).not.toThrow();
    });

    it('should throw when test fails', () => {
      const node = NodeDeserializer.deserialize({ value: 'actual' });

      const patches: BlueNodePatch[] = [
        { op: 'test', path: '/value', val: 'expected' },
      ];

      expect(() => applyBlueNodePatches(node, patches)).toThrow(/TEST failed/);
    });

    it('should test array elements', () => {
      const node = NodeDeserializer.deserialize({
        list: ['a', 'b', 'c'],
      });

      const patches: BlueNodePatch[] = [
        { op: 'test', path: '/list/0/value', val: 'a' },
        { op: 'test', path: '/list/1/value', val: 'b' },
        { op: 'test', path: '/list/2/value', val: 'c' },
      ];

      expect(() => applyBlueNodePatches(node, patches)).not.toThrow();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed operations in sequence', () => {
      const node = NodeDeserializer.deserialize({
        users: [
          { id: 1, name: 'Alice', active: true },
          { id: 2, name: 'Bob', active: false },
        ],
        metadata: {
          count: 2,
          lastUpdate: '2024-01-01',
        },
      });

      const patches: BlueNodePatch[] = [
        // Test current state
        {
          op: 'test',
          path: '/metadata/count/value',
          val: new BigIntegerNumber(2),
        },
        // Add new user
        {
          op: 'add',
          path: '/users/-',
          val: { id: 3, name: 'Charlie', active: true },
        },
        // Update metadata count
        { op: 'replace', path: '/metadata/count/value', val: 3 },
        // Deactivate Bob
        { op: 'replace', path: '/users/1/active/value', val: false },
        // Copy Charlie to a backup
        { op: 'copy', from: '/users/2', path: '/lastAddedUser' },
        // Move lastUpdate to history
        {
          op: 'move',
          from: '/metadata/lastUpdate',
          path: '/metadata/previousUpdate',
        },
        // Set new lastUpdate
        { op: 'add', path: '/metadata/lastUpdate', val: '2024-01-15' },
      ];

      const result = applyBlueNodePatches(node, patches);

      expect((result.get('/users') as BlueNode)?.getItems()?.length).toBe(3);
      expect(result.get('/users/2/name/value')).toBe('Charlie');
      expect(result.get('/metadata/count/value')?.toString()).toBe('3');
      expect(result.get('/lastAddedUser/name/value')).toBe('Charlie');
      expect(result.get('/metadata/previousUpdate/value')).toBe('2024-01-01');
      expect(result.get('/metadata/lastUpdate/value')).toBe('2024-01-15');
    });

    it('should handle operations on different representations of arrays', () => {
      // Array as root
      const arr1 = NodeDeserializer.deserialize(['a', 'b', 'c']);
      const patches1: BlueNodePatch[] = [
        { op: 'replace', path: '/1/value', val: 'B' },
      ];
      const result1 = applyBlueNodePatches(arr1, patches1);
      expect(result1.getItems()?.[1].getValue()).toBe('B');

      // Array as property
      const arr2 = NodeDeserializer.deserialize({ list: ['a', 'b', 'c'] });
      const patches2: BlueNodePatch[] = [
        { op: 'replace', path: '/list/1/value', val: 'B' },
      ];
      const result2 = applyBlueNodePatches(arr2, patches2);
      expect(result2.get('/list/1/value')).toBe('B');

      // Array with explicit items
      const arr3 = NodeDeserializer.deserialize({
        items: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
      });
      const patches3: BlueNodePatch[] = [
        { op: 'replace', path: '/items/1/value', val: 'B' },
      ];
      const result3 = applyBlueNodePatches(arr3, patches3);
      expect(result3.getItems()?.[1].getValue()).toBe('B');
    });

    it('should handle edge cases with undefined and null', () => {
      const node = NodeDeserializer.deserialize({
        nullable: null,
        defined: 'value',
        obj: { nested: null },
      });

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/nullable', val: 'no-longer-null' },
        { op: 'replace', path: '/defined', val: null },
        { op: 'add', path: '/newNull', val: null },
        { op: 'replace', path: '/obj/nested', val: { deep: 'value' } },
      ];

      const result = applyBlueNodePatches(node, patches);
      expect(result.get('/nullable/value')).toBe('no-longer-null');
      expect(result.get('/defined/value')).toBe(null);
      expect(result.get('/newNull/value')).toBe(null);
      expect(result.get('/obj/nested/deep/value')).toBe('value');
    });

    it('should handle operations that create nested structures', () => {
      const node = NodeDeserializer.deserialize({ root: {} });

      const patches: BlueNodePatch[] = [
        // Create nested structure in one go
        {
          op: 'add',
          path: '/root/level1',
          val: {
            level2: {
              level3: {
                data: 'deep-value',
                list: [1, 2, 3],
              },
            },
          },
        },
        // Then modify the deep structure
        { op: 'add', path: '/root/level1/level2/level3/list/-', val: 4 },
        {
          op: 'replace',
          path: '/root/level1/level2/level3/data/value',
          val: 'updated-deep',
        },
      ];

      const result = applyBlueNodePatches(node, patches);
      expect(result.get('/root/level1/level2/level3/data/value')).toBe(
        'updated-deep',
      );
      expect(
        (result.get('/root/level1/level2/level3/list') as BlueNode)?.getItems()
          ?.length,
      ).toBe(4);
    });
  });

  describe('Error Cases', () => {
    it('should throw when path does not start with /', () => {
      const node = NodeDeserializer.deserialize({ value: 'test' });
      const patch: BlueNodePatch = {
        op: 'replace',
        path: 'value',
        val: 'new',
      };
      expect(() => applyBlueNodePatch(node, patch)).toThrow(/must start with/);
    });

    it('should throw when trying to access non-existent intermediate paths', () => {
      const node = NodeDeserializer.deserialize({ shallow: 'value' });
      const patch: BlueNodePatch = {
        op: 'add',
        path: '/does/not/exist',
        val: 'value',
      };
      expect(() => applyBlueNodePatch(node, patch)).toThrow();
    });

    it('should handle out-of-bounds array access gracefully', () => {
      const node = NodeDeserializer.deserialize(['a', 'b']);
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/5',
        val: 'x',
      };
      expect(() => applyBlueNodePatch(node, patch)).toThrow(
        /REPLACE failed: Target array index '5' is out of bounds or does not exist at path '\/5'\./,
      );
    });
  });

  describe('Mutate vs Clone', () => {
    it('should not mutate original by default', () => {
      const node = NodeDeserializer.deserialize({ value: 'original' });
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/value',
        val: 'modified',
      };

      const result = applyBlueNodePatch(node, patch);
      expect(node.getValue()).toBe('original');
      expect(result.getValue()).toBe('modified');
    });

    it('should mutate original when mutateOriginal is true', () => {
      const node = NodeDeserializer.deserialize({ value: 'original' });
      const patch: BlueNodePatch = {
        op: 'replace',
        path: '/value',
        val: 'modified',
      };

      const result = applyBlueNodePatch(node, patch, true);
      expect(node.getValue()).toBe('modified');
      expect(result).toBe(node); // same reference
    });

    it('should throw on move from non-existent path', () => {
      const problemFn = () => {
        const tempNode = NodeDeserializer.deserialize({ a: 1 });
        const patch: BlueNodePatch = {
          op: 'move',
          from: '/does-not-exist',
          path: '/a',
        };
        applyBlueNodePatch(tempNode, patch);
      };
      expect(problemFn).toThrow(
        /MOVE failed: 'from' location '\/does-not-exist' does not exist./,
      );
    });
  });
});
