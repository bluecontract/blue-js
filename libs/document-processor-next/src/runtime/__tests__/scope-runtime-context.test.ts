import { createBlue } from '../../test-support/blue.js';
import { describe, expect, it } from 'vitest';

import { ScopeRuntimeContext } from '../scope-runtime-context.js';

const blue = createBlue();

function nodeFrom(json: unknown) {
  return blue.jsonValueToNode(json);
}

describe('ScopeRuntimeContext', () => {
  it('enqueues and drains triggered queue respecting cut-off', () => {
    const context = new ScopeRuntimeContext('/scope');
    const first = nodeFrom({ id: 1 });
    const second = nodeFrom({ id: 2 });
    const third = nodeFrom({ id: 3 });

    context.enqueueTriggered(first);
    context.enqueueTriggered(second);
    context.markCutOff();
    context.enqueueTriggered(third); // ignored due to cut-off limit

    expect(context.triggeredSize()).toBe(2);
    expect(context.pollTriggered()).toBe(first);
    expect(context.pollTriggered()).toBe(second);
    expect(context.pollTriggered()).toBeUndefined();
  });

  it('records bridgeable events with cut-off limit', () => {
    const context = new ScopeRuntimeContext('/scope');
    const events = [0, 1, 2].map((id) => nodeFrom({ id }));

    context.recordBridgeable(events[0]);
    context.markCutOff();
    context.recordBridgeable(events[1]);
    context.recordBridgeable(events[2]); // ignored

    expect(context.drainBridgeableEvents()).toEqual(events.slice(0, 1));
    expect(context.drainBridgeableEvents()).toEqual([]);
  });

  it('finalizes termination once', () => {
    const context = new ScopeRuntimeContext('/scope');
    context.enqueueTriggered(nodeFrom({ id: 'event' }));
    context.finalizeTermination('GRACEFUL', 'done');

    expect(context.isTerminated()).toBe(true);
    expect(context.terminationKind()).toBe('GRACEFUL');
    expect(context.terminationReason()).toBe('done');
    expect(context.triggeredSize()).toBe(0);
  });
});
