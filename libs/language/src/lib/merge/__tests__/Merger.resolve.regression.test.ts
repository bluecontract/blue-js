import { describe, it, expect } from 'vitest';
import { Blue } from '../../Blue';
import { BasicNodeProvider } from '../../provider';

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
    expect(resolved.get('/0/type/blueId')).toBe(entryTypeBlueId);
    expect(resolved.get('/1/type/blueId')).toBe(entryTypeBlueId);
    expect(resolved.get('/0/payload/id')).toBe('child-1');
    expect(resolved.get('/1/payload/id')).toBe('child-2');

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
});
