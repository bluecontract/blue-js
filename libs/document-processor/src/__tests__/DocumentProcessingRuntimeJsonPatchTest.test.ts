import { createBlue } from '../test-support/blue.js';
import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { array, numericValue, property } from './test-utils.js';

const blue = createBlue();

function nodeFrom(json: unknown): BlueNode {
  if (json instanceof BlueNode) {
    return json.clone();
  }
  return blue.jsonValueToNode(json);
}

function add(path: string, val: unknown): JsonPatch {
  return { op: 'ADD', path, val: nodeFrom(val) } as JsonPatch;
}

function replace(path: string, val: unknown): JsonPatch {
  return { op: 'REPLACE', path, val: nodeFrom(val) } as JsonPatch;
}

function remove(path: string): JsonPatch {
  return { op: 'REMOVE', path } as JsonPatch;
}

function arrayDocument(key: string, ...entries: unknown[]): BlueNode {
  return new BlueNode().setProperties({
    [key]: new BlueNode().setItems(entries.map(nodeFrom)),
  });
}

describe('DocumentProcessingRuntimeJsonPatchTest', () => {
  it('addNestedPropertyCreatesIntermediateObjects', () => {
    const document = new BlueNode();
    const runtime = new DocumentProcessingRuntime(document, blue);

    const result = runtime.applyPatch('/', add('/foo/bar/baz', 'qux'));

    expect(result.before).toBeNull();
    expect(result.after?.getValue()).toBe('qux');
    expect(result.path).toBe('/foo/bar/baz');

    const baz = property(property(property(document, 'foo'), 'bar'), 'baz');
    expect(baz.getValue()).toBe('qux');
  });

  it('replaceUpsertsObjectProperty', () => {
    const document = new BlueNode();
    const runtime = new DocumentProcessingRuntime(document, blue);

    const upsert = runtime.applyPatch('/', replace('/alpha/beta', 'v1'));
    expect(upsert.before).toBeNull();
    expect(upsert.after?.getValue()).toBe('v1');

    const update = runtime.applyPatch('/', replace('/alpha/beta', 'v2'));
    expect(update.before?.getValue()).toBe('v1');
    expect(update.after?.getValue()).toBe('v2');

    const beta = property(property(document, 'alpha'), 'beta');
    expect(beta.getValue()).toBe('v2');
  });

  it('removeObjectProperty', () => {
    const document = nodeFrom({ key: 'value' });
    const runtime = new DocumentProcessingRuntime(document, blue);

    const data = runtime.applyPatch('/', remove('/key'));
    expect(data.before?.getValue()).toBe('value');
    expect(data.after).toBeNull();
    expect(document.getProperties()?.key).toBeUndefined();
  });

  it('removeMissingObjectPropertyFailsWithoutMutation', () => {
    const document = new BlueNode();
    const runtime = new DocumentProcessingRuntime(document, blue);

    expect(() => runtime.applyPatch('/', remove('/missing'))).toThrowError(
      /missing/i,
    );
    expect(document.getProperties()).toBeUndefined();
  });

  it('addArrayElementAtIndexShiftsExisting', () => {
    const document = arrayDocument('items', 1, 2, 3);
    const runtime = new DocumentProcessingRuntime(document, blue);

    const data = runtime.applyPatch('/', add('/items/1', 99));
    expect(numericValue(data.before as BlueNode)).toBe(2);
    expect(numericValue(data.after as BlueNode)).toBe(99);

    const items = array(document, 'items');
    expect(items).toHaveLength(4);
    expect(numericValue(items[0]!)).toBe(1);
    expect(numericValue(items[1]!)).toBe(99);
    expect(numericValue(items[2]!)).toBe(2);
    expect(numericValue(items[3]!)).toBe(3);
  });

  it('addArrayElementAppendToken', () => {
    const document = arrayDocument('values', 4, 5);
    const runtime = new DocumentProcessingRuntime(document, blue);

    const data = runtime.applyPatch('/', add('/values/-', 6));
    expect(data.before).toBeNull();
    expect(numericValue(data.after as BlueNode)).toBe(6);

    const items = array(document, 'values');
    expect(items).toHaveLength(3);
    expect(numericValue(items[2]!)).toBe(6);
  });

  it('replaceArrayElementRequiresExistingIndex', () => {
    const document = arrayDocument('nums', 7, 8);
    const runtime = new DocumentProcessingRuntime(document, blue);

    const data = runtime.applyPatch('/', replace('/nums/1', 80));
    expect(numericValue(data.before as BlueNode)).toBe(8);
    expect(numericValue(data.after as BlueNode)).toBe(80);
    expect(numericValue(array(document, 'nums')[1]!)).toBe(80);

    expect(() => runtime.applyPatch('/', replace('/nums/5', 123))).toThrowError(
      /out of bounds/i,
    );
    expect(array(document, 'nums')).toHaveLength(2);
  });

  it('removeArrayElement', () => {
    const document = arrayDocument('letters', 'a', 'b', 'c');
    const runtime = new DocumentProcessingRuntime(document, blue);

    const data = runtime.applyPatch('/', remove('/letters/1'));
    expect(data.before?.getValue()).toBe('b');
    expect(data.after).toBeNull();

    const items = array(document, 'letters');
    expect(items).toHaveLength(2);
    expect(items[0]?.getValue()).toBe('a');
    expect(items[1]?.getValue()).toBe('c');
  });

  it('removeArrayOutOfBoundsFailsWithoutMutation', () => {
    const document = arrayDocument('letters', 'x');
    const runtime = new DocumentProcessingRuntime(document, blue);

    expect(() => runtime.applyPatch('/', remove('/letters/5'))).toThrowError(
      /out of bounds/i,
    );
    expect(array(document, 'letters')).toHaveLength(1);
  });

  it('arrayElementSubpathRequiresExistingElement', () => {
    const arrayNode = new BlueNode().setItems([]);
    const document = new BlueNode().setProperties({ arr: arrayNode });
    const runtime = new DocumentProcessingRuntime(document, blue);

    expect(() =>
      runtime.applyPatch('/', add('/arr/0/name', 'bad')),
    ).toThrowError(/array index/i);
    expect(arrayNode.getItems()).toHaveLength(0);
    expect(property(document, 'arr').getProperties()).toBeUndefined();
  });

  it('appendTokenOnObjectFailsAndRollsBack', () => {
    const document = new BlueNode();
    const runtime = new DocumentProcessingRuntime(document, blue);

    expect(() => runtime.applyPatch('/', add('/foo/-', 'nope'))).toThrowError(
      /append token/i,
    );
    expect(document.getProperties()).toBeUndefined();
  });

  it('addPropertyWithEmptySegmentsMaintainsLiteralPointer', () => {
    const document = new BlueNode();
    const runtime = new DocumentProcessingRuntime(document, blue);

    runtime.applyPatch('/', add('/foo//bar/', 'lit'));

    const foo = property(document, 'foo');
    const empty = property(foo, '');
    const bar = property(empty, 'bar');
    const trailing = property(bar, '');
    expect(trailing.getValue()).toBe('lit');
  });

  it('removePropertyWithEmptySegmentsCleansUpLeaf', () => {
    const document = new BlueNode();
    const runtime = new DocumentProcessingRuntime(document, blue);

    runtime.applyPatch('/', add('/foo//bar', 'lit'));
    runtime.applyPatch('/', remove('/foo//bar'));

    const foo = property(document, 'foo');
    const empty = property(foo, '');
    expect(empty.getProperties()).not.toHaveProperty('bar');
  });

  it('tildeSegmentsAreNotUnescaped', () => {
    const document = new BlueNode();
    const runtime = new DocumentProcessingRuntime(document, blue);

    runtime.applyPatch('/', add('/tilde/~1key', 'value'));

    const tilde = property(document, 'tilde');
    const literal = property(tilde, '~1key');
    expect(literal.getValue()).toBe('value');
  });

  it('appendObjectAllowsNestedStructure', () => {
    const document = arrayDocument('rows', 1);
    const runtime = new DocumentProcessingRuntime(document, blue);

    const nested = new BlueNode().setProperties({ c: nodeFrom('v') });
    const appended = new BlueNode().setProperties({ b: nested });
    runtime.applyPatch('/', add('/rows/-', appended));

    const rows = array(document, 'rows');
    const created = rows[rows.length - 1]!;
    const child = property(created, 'b');
    const grandChild = property(child, 'c');
    expect(grandChild.getValue()).toBe('v');
  });

  it('snapshotsAreClones', () => {
    const document = arrayDocument('numbers', 1);
    const runtime = new DocumentProcessingRuntime(document, blue);

    const data = runtime.applyPatch('/', replace('/numbers/0', 2));

    (data.before as BlueNode)?.setProperties({
      mutated: nodeFrom(true),
    });
    (data.after as BlueNode)?.setProperties({
      mutated: nodeFrom(true),
    });

    const stored = array(document, 'numbers')[0]!;
    expect(stored.getProperties()).toBeUndefined();
    expect(numericValue(stored)).toBe(2);
  });
});
