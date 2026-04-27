import { describe, it, expect } from 'vitest';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { BasicNodeProvider } from '../../provider';
import { PathLimitsBuilder } from '../../utils/limits/PathLimits';

describe('Merger resolve regression', () => {
  it('keeps resolve behavior stable for typed trees with repeated type references', () => {
    const nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(`
name: EntryType
description: Base entry type
status:
  value: draft
meta:
  source: template
payload:
  kind: generic
`);

    const entryTypeBlueId = nodeProvider.getBlueIdByName('EntryType');

    nodeProvider.addSingleDocs(`
name: RuntimeEntry
type:
  blueId: ${entryTypeBlueId}
meta:
  owner: qa
payload:
  id: runtime-1
children:
  items:
    - type:
        blueId: ${entryTypeBlueId}
      payload:
        id: child-1
    - type:
        blueId: ${entryTypeBlueId}
      payload:
        id: child-2
`);

    const blue = new Blue({ nodeProvider });
    const runtimeNode = nodeProvider.getNodeByName('RuntimeEntry');

    const sourceBeforeResolve = blue.nodeToJson(runtimeNode, 'official');

    const resolved = blue.resolve(runtimeNode);
    const resolvedJson = blue.nodeToJson(resolved, 'official');

    expect(resolved.isResolved()).toBe(true);
    expect(resolved.get('/meta/source')).toBe('template');
    expect(resolved.get('/meta/owner')).toBe('qa');
    expect(resolved.get('/payload/kind')).toBe('generic');
    expect(resolved.get('/payload/id')).toBe('runtime-1');
    expect(resolved.get('/children/0/type/blueId')).toBe(entryTypeBlueId);
    expect(resolved.get('/children/1/type/blueId')).toBe(entryTypeBlueId);
    expect(resolved.get('/children/0/payload/id')).toBe('child-1');
    expect(resolved.get('/children/1/payload/id')).toBe('child-2');

    expect(resolvedJson).toMatchObject({
      name: 'RuntimeEntry',
      type: {
        name: 'EntryType',
        description: 'Base entry type',
        blueId: entryTypeBlueId,
      },
      status: {
        value: 'draft',
      },
      meta: {
        source: { value: 'template' },
        owner: { value: 'qa' },
      },
      payload: {
        kind: { value: 'generic' },
        id: { value: 'runtime-1' },
      },
      children: {
        items: [
          {
            type: { blueId: entryTypeBlueId },
            status: { value: 'draft' },
            payload: {
              kind: { value: 'generic' },
              id: { value: 'child-1' },
            },
          },
          {
            type: { blueId: entryTypeBlueId },
            status: { value: 'draft' },
            payload: {
              kind: { value: 'generic' },
              id: { value: 'child-2' },
            },
          },
        ],
      },
    });

    // Source node should remain unchanged after resolve.
    expect(blue.nodeToJson(runtimeNode, 'official')).toEqual(
      sourceBeforeResolve,
    );
    expect(runtimeNode.isResolved()).toBe(false);

    // Resolving an already resolved node should keep the same result.
    const resolvedAgain = blue.resolve(resolved);
    expect(blue.nodeToJson(resolvedAgain, 'official')).toEqual(resolvedJson);
  });

  it('validates Dictionary keyType constraints in default resolve pipeline', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

    const invalidDictionary = blue.jsonValueToNode({
      name: 'InvalidIntegerKeyDict',
      type: 'Dictionary',
      keyType: 'Integer',
      valueType: 'Text',
      abc: 'value',
    });

    expect(() => blue.resolve(invalidDictionary)).toThrow(
      "Key 'abc' is not a valid Integer.",
    );
  });

  it('does not leak mutations from an exposed resolved type into later resolves', () => {
    const nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(`
name: SharedType
shared:
  value: inherited
`);

    const sharedTypeBlueId = nodeProvider.getBlueIdByName('SharedType');
    const blue = new Blue({ nodeProvider });
    const nodeA = blue.yamlToNode(`
name: RuntimeA
type:
  blueId: ${sharedTypeBlueId}
local: A
`);
    const nodeB = blue.yamlToNode(`
name: RuntimeB
type:
  blueId: ${sharedTypeBlueId}
local: B
`);

    const resolvedA = blue.resolve(nodeA);
    resolvedA
      .getType()
      ?.addProperty('leaked', new BlueNode().setValue('mutation'));

    const resolvedB = blue.resolve(nodeB);

    expect(resolvedB.get('/type/leaked')).toBeUndefined();
    expect(resolvedB.get('/leaked')).toBeUndefined();
  });

  it('does not share exposed resolved type objects between siblings in one resolve', () => {
    const provider = new BasicNodeProvider();

    provider.addSingleDocs(`
name: SharedType
shared: inherited
`);

    const sharedTypeId = provider.getBlueIdByName('SharedType');
    const blue = new Blue({ nodeProvider: provider });

    const source = blue.yamlToNode(`
first:
  type:
    blueId: ${sharedTypeId}
second:
  type:
    blueId: ${sharedTypeId}
`);

    const resolved = blue.resolve(source);

    const firstType = resolved.get('/first/type') as BlueNode;
    firstType.addProperty('leaked', new BlueNode().setValue('mutation'));

    expect(resolved.get('/second/type/leaked')).toBeUndefined();
  });

  it('enforces basic-type shape constraints in default resolve pipeline', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

    const invalidBasicTypeNode = blue.jsonValueToNode({
      name: 'InvalidByNameType',
      type: { name: 'Text' },
      extra: 'x',
    });

    expect(() => blue.resolve(invalidBasicTypeNode)).toThrow(
      'must not have items, properties or contracts.',
    );
  });

  it('keeps full list overlay PathLimits behavior explicit', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const itemA = new BlueNode().setValue('A');
    const itemB = new BlueNode().setValue('B');
    const itemC = new BlueNode().setValue('C');
    const itemD = new BlueNode().setValue('D');

    const base = new BlueNode('Base').setProperties({
      list: new BlueNode().setItems([itemA.clone(), itemB.clone()]),
    });
    nodeProvider.addSingleNodes(base);
    const baseNode = nodeProvider.getNodeByName('Base');
    if (!baseNode) {
      throw new Error('Expected Base node to be stored');
    }
    const mid = new BlueNode('Mid')
      .setType(new BlueNode().setBlueId(nodeProvider.getBlueIdByName('Base')))
      .setProperties({
        list: new BlueNode().setItems([
          itemA.clone(),
          itemB.clone(),
          itemC.clone(),
        ]),
      });
    nodeProvider.addSingleNodes(mid);
    const midNode = nodeProvider.getNodeByName('Mid');
    if (!midNode) {
      throw new Error('Expected Mid node to be stored');
    }
    const derived = new BlueNode('Derived')
      .setType(new BlueNode().setBlueId(nodeProvider.getBlueIdByName('Mid')))
      .setProperties({
        list: new BlueNode().setItems([
          itemA.clone(),
          itemB.clone(),
          itemC.clone(),
          itemD.clone(),
        ]),
      });

    const limits = new PathLimitsBuilder().addPath('/list/3').build();
    const limitedResolved = blue.resolve(derived, limits);
    const limitedSimple = blue.nodeToJson(limitedResolved, 'simple') as {
      list?: unknown[];
    };

    expect(limitedSimple.list).toEqual(['D']);
  });
});
