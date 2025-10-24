import { BlueNode } from '@blue-labs/language';
import { describe, it, expect } from 'vitest';

import { CheckpointManager } from '../engine/checkpoint-manager.js';
import { ContractBundle } from '../engine/contract-bundle.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { property } from './test-utils.js';

describe('CheckpointManagerTest', () => {
  it('ensureCheckpointCreatesMarkerWhenAbsent', () => {
    const runtime = new DocumentProcessingRuntime(new BlueNode());
    const manager = new CheckpointManager(runtime, () => null);
    const bundle = ContractBundle.builder().build();

    manager.ensureCheckpointMarker('/', bundle);

    const contracts = property(runtime.document(), 'contracts');
    const checkpoint = property(contracts, 'checkpoint');
    expect(checkpoint).toBeInstanceOf(BlueNode);
    expect(bundle.marker('checkpoint')).toBeDefined();
  });

  it('persistUpdatesCheckpointAndChargesGas', () => {
    const runtime = new DocumentProcessingRuntime(new BlueNode());
    const manager = new CheckpointManager(runtime, (node) =>
      node != null ? 'sig' : null
    );
    const bundle = ContractBundle.builder().build();
    manager.ensureCheckpointMarker('/', bundle);

    const record = manager.findCheckpoint(bundle, 'testChannel');
    expect(record).toBeDefined();
    if (!record) {
      return;
    }
    const eventNode = new BlueNode().setValue('payload');

    manager.persist('/', bundle, record, 'nextSig', eventNode);

    const contracts = property(runtime.document(), 'contracts');
    const checkpoint = property(contracts, 'checkpoint');
    const lastEvents = property(checkpoint, 'lastEvents');
    const stored = property(lastEvents, 'testChannel');
    expect(stored.getValue()).toBe('payload');
    expect(runtime.totalGas()).toBe(20);
    expect(record.lastEventSignature).toBe('nextSig');
  });
});
