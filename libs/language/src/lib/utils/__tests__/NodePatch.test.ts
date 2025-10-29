import { describe, it, expect } from 'vitest';
import {
  applyBlueNodePatch,
  applyBlueNodePatches,
  BlueNodePatch,
} from '../NodePatch';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { BlueNode } from '../../model/Node';

describe('applyBluePatch → BlueNode', () => {
  function makeCustomer(): BlueNode {
    return NodeDeserializer.deserialize({
      name: 'Customer',
      age: 1,
      personName: 'Alice',
      contracts: {
        timelineCh: {
          type: 'Timeline Channel',
          timelineId: 'timeline-1',
        },
        contract1: {
          type: 'Sequential Workflow',
          channel: 'timelineCh',
          steps: [],
        },
      },
      list: [{ value: 'first' }, { value: 'second' }],
    });
  }

  it('adds primitive via /age', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch = { op: 'add', path: '/age', val: 30 };
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/age/value')?.toString()).toBe('30');
  });

  it('replaces string via /personName', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch = {
      op: 'replace',
      path: '/personName',
      val: 'Bob',
    };
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/personName/value')).toBe('Bob');
  });

  it('adds using explicit /age/value path', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch = { op: 'replace', path: '/age/value', val: 25 };
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/age/value')?.toString()).toBe('25');
  });

  it('removes a property', () => {
    const root = makeCustomer();
    const patchesArray: BlueNodePatch[] = [
      { op: 'remove', path: '/personName' },
      { op: 'remove', path: '/contracts/contract1' },
      { op: 'remove', path: '/list/0' },
    ];
    const result = applyBlueNodePatches(root, patchesArray);
    expect(result.get('/personName')).toBeUndefined();
    const contracts = result.getContracts();
    expect(Object.keys(contracts ?? {}).some((c) => c === 'contract1')).toBe(
      false,
    );
    const list = result.get('/list') as BlueNode;
    expect(list.getItems()).toHaveLength(1);
    expect(result.get('/list/0')).toBe('second');
  });

  it('copies and moves between properties', () => {
    const root = makeCustomer();
    const patchesArray: BlueNodePatch[] = [
      { op: 'copy', from: '/personName', path: '/nick' },
      { op: 'move', from: '/age', path: '/years' },
    ];
    const result = applyBlueNodePatches(root, patchesArray);
    expect(result.get('/personName')).toBe('Alice');
    expect(result.get('/nick/value')).toBe('Alice');
    expect(result.get('/years/value')?.toString()).toBe('1');
    expect(result.get('/age')).toBeUndefined();
  });

  it('adds element to list array via "-" index', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch = {
      op: 'add',
      path: '/list/-',
      val: { value: 'third' },
    };
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/list/2/value')).toBe('third');
  });

  it('passes test when value matches', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch = {
      op: 'test',
      path: '/personName/value',
      val: 'Alice',
    };
    const result = applyBlueNodePatch(root, patch);
    expect(result).toBeDefined();
  });

  it('throws on test when value mismatches', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch = {
      op: 'test',
      path: '/personName/value',
      val: 'Bob',
    };
    expect(() => applyBlueNodePatch(root, patch)).toThrow(/TEST failed/);
  });

  it('allows replace to create property if parent exists (one-hop creation)', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch = { op: 'replace', path: '/missing', val: 1 };
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/missing/value')?.toString()).toBe('1');
  });

  it('throws on replace when intermediate paths are missing', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch = {
      op: 'replace',
      path: '/missing/nested',
      val: 1,
    };
    let errorThrown: Error | undefined;
    try {
      applyBlueNodePatch(root, patch);
    } catch (e) {
      errorThrown = e as Error;
    }
    expect(errorThrown).toBeInstanceOf(Error);
    expect(errorThrown?.message).toMatch(/Cannot resolve '\/missing'/);
  });

  it('allows replace to create contract in existing contracts object', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch = {
      op: 'replace',
      path: '/contracts/newContract',
      val: {
        type: 'Timeline Channel',
        timelineId: 'test-timeline',
      },
    };
    const result = applyBlueNodePatch(root, patch);
    const contracts = result.getContracts();
    expect(contracts?.newContract).toBeDefined();
    expect(contracts?.newContract.get('/type/value')).toBe('Timeline Channel');
  });
});
