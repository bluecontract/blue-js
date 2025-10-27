import { createBlue } from '../../test-support/blue.js';
import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { PatchEngine } from '../patch-engine.js';
import type { JsonPatch } from '../../model/shared/json-patch.js';

const blue = createBlue();

function nodeFrom(json: unknown) {
  return blue.jsonValueToNode(json);
}

describe('PatchEngine', () => {
  it('applies add patch and records before/after snapshots', () => {
    const document = nodeFrom({ name: 'Initial' });
    const engine = new PatchEngine(document);
    const patch: JsonPatch = {
      op: 'ADD',
      path: '/status',
      val: nodeFrom('ACTIVE'),
    };

    const result = engine.applyPatch('/', patch);

    expect(result.before).toBeNull();
    expect(result.after?.getValue()).toBe('ACTIVE');
    expect(result.cascadeScopes).toEqual(['/']);
    expect(document.get('/status')).not.toBeNull();
  });

  it('applies remove patch returning prior state', () => {
    const document = nodeFrom({ status: 'ACTIVE' });
    const engine = new PatchEngine(document);
    const patch: JsonPatch = {
      op: 'REMOVE',
      path: '/status',
    };

    const result = engine.applyPatch('/', patch);

    expect(result.before).not.toBeNull();
    expect(result.after).toBeNull();
    expect(document.get('/status')).toBeUndefined();
  });

  it('supports directWrite for objects and arrays', () => {
    const document = new BlueNode().setProperties({
      status: nodeFrom('old'),
      items: new BlueNode().setItems([nodeFrom({ value: 'one' })]),
    });
    const engine = new PatchEngine(document);

    engine.directWrite('/status', nodeFrom('updated'));
    engine.directWrite('/items/1', nodeFrom({ value: 'two' }));
    engine.directWrite('/items/0', null);

    const dataValue = document.get('/status');
    expect(dataValue instanceof BlueNode ? dataValue.getValue() : dataValue).toBe('updated');
    expect(document.get('/items/0/value')).toBe('two');
  });
});
