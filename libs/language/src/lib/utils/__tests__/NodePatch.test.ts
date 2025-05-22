import { describe, it, expect } from 'vitest';
import { applyBlueNodePatch, BlueNodePatch } from '../NodePatch';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { BlueNode } from '../../model/Node';

describe('applyBluePatch → BlueNode', () => {
  function makeCustomer(): BlueNode {
    return NodeDeserializer.deserialize({
      name: 'Customer',
      age: 1,
      personName: 'Alice',
      list: [{ value: 'first' }, { value: 'second' }],
    });
  }

  it('adds primitive via /age', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch[] = [{ op: 'add', path: '/age', value: 30 }];
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/age/value')?.toString()).toBe('30');
  });

  it('replaces string via /personName', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch[] = [
      { op: 'replace', path: '/personName', value: 'Bob' },
    ];
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/personName/value')).toBe('Bob');
  });

  it('adds using explicit /age/value path', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch[] = [
      { op: 'replace', path: '/age/value', value: 25 },
    ];
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/age/value')?.toString()).toBe('25');
  });

  it('removes a property', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch[] = [{ op: 'remove', path: '/personName' }];
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/personName')).toBeUndefined();
  });

  it('copies and moves between properties', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch[] = [
      { op: 'copy', from: '/personName', path: '/nick' },
      { op: 'move', from: '/age', path: '/years' },
    ];
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/personName')).toBe('Alice');
    expect(result.get('/nick/value')).toBe('Alice');
    expect(result.get('/years/value')?.toString()).toBe('1');
    expect(result.get('/age')).toBeUndefined();
  });

  it('adds element to list array via "-" index', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch[] = [
      { op: 'add', path: '/list/-', value: { value: 'third' } },
    ];
    const result = applyBlueNodePatch(root, patch);
    expect(result.get('/list/2/value')).toBe('third');
  });

  it('passes test when value matches', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch[] = [
      { op: 'test', path: '/personName/value', value: 'Alice' },
    ];
    const result = applyBlueNodePatch(root, patch);
    expect(result).toBeDefined();
  });

  it('throws on test when value mismatches', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch[] = [
      { op: 'test', path: '/personName/value', value: 'Bob' },
    ];
    expect(() => applyBlueNodePatch(root, patch)).toThrow(/TEST failed/);
  });

  it('throws on replace to non-existing path', () => {
    const root = makeCustomer();
    const patch: BlueNodePatch[] = [
      { op: 'replace', path: '/missing', value: 1 },
    ];
    expect(() => applyBlueNodePatch(root, patch)).toThrow(
      /REPLACE path not found/
    );
  });
});
