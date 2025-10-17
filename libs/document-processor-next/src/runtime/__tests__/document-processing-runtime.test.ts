import { describe, expect, it } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';

import { DocumentProcessingRuntime } from '../document-processing-runtime.js';
import type { JsonPatch } from '../../model/shared/json-patch.js';

const blue = new Blue();

function nodeFrom(json: unknown) {
  return blue.jsonValueToNode(json);
}

describe('DocumentProcessingRuntime', () => {
  it('tracks gas charges and patch application', () => {
    const document = new BlueNode().setProperties({
      status: nodeFrom('NEW'),
    });
    const runtime = new DocumentProcessingRuntime(document);

    runtime.chargeInitialization();
    runtime.chargeScopeEntry('/child');

    const patch: JsonPatch = {
      op: 'REPLACE',
      path: '/status',
      val: nodeFrom('UPDATED'),
    };

    const update = runtime.applyPatch('/', patch);

    expect(update.after?.getValue()).toBe('UPDATED');
    expect(update.cascadeScopes).toEqual(['/']);
    expect(runtime.document().get('/status')).toBe('UPDATED');
    expect(runtime.totalGas()).toBeGreaterThan(0);
  });

  it('manages runtime scopes, emissions, and direct writes', () => {
    const document = new BlueNode().setProperties({
      list: new BlueNode().setItems([nodeFrom({ value: 'one' })]),
    });
    const runtime = new DocumentProcessingRuntime(document);

    const scope = runtime.scope('/child');
    scope.enqueueTriggered(nodeFrom({ event: 1 }));
    runtime.recordRootEmission(nodeFrom({ eventType: 'Lifecycle' }));

    runtime.directWrite('/list/1', nodeFrom({ value: 'two' }));
    runtime.directWrite('/list/0', null);

    expect(runtime.rootEmissions()).toHaveLength(1);
    expect(runtime.scope('/child')).toBe(scope);
    expect(runtime.existingScope('/missing')).toBeUndefined();
    expect(runtime.document().get('/list/0/value')).toBe('two');

    runtime.markRunTerminated();
    expect(runtime.isRunTerminated()).toBe(true);
  });
});
