import { describe, expect, it } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';

import { CheckpointManager } from '../checkpoint-manager.js';
import { ContractBundle } from '../contract-bundle.js';
import { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
import { KEY_CHECKPOINT } from '../../constants/processor-contract-constants.js';
import type { ChannelEventCheckpoint } from '../../model/index.js';
import type { Node } from '../../types/index.js';

const blue = new Blue();

function createRootDocument(): BlueNode {
  return new BlueNode().setProperties({
    contracts: new BlueNode().setProperties({}),
  });
}

function nodeFrom(json: unknown): BlueNode {
  return blue.jsonValueToNode(json);
}

function signatureFn(node: Node | null): string | null {
  return node ? node.toString() : null;
}

describe('CheckpointManager', () => {
  it('ensures checkpoint marker exists in bundle and document', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument());
    const bundle = ContractBundle.builder().build();
    const manager = new CheckpointManager(runtime, signatureFn);

    manager.ensureCheckpointMarker('/', bundle);

    const marker = bundle.marker(KEY_CHECKPOINT);
    expect(marker).toBeDefined();
    const stored = runtime.document().get('/contracts/checkpoint');
    expect(stored).toBeInstanceOf(BlueNode);
  });

  it('finds checkpoint records and persists updates', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument());
    const bundle = ContractBundle.builder().build();
    const manager = new CheckpointManager(runtime, signatureFn);
    manager.ensureCheckpointMarker('/', bundle);

    const marker = bundle.marker(KEY_CHECKPOINT)! as ChannelEventCheckpoint;
    const existingEvent = nodeFrom({ payload: { id: 'prior' } });
    marker.lastEvents.channelA = existingEvent;

    const record = manager.findCheckpoint(bundle, 'channelA');
    expect(record).not.toBeNull();
    if (!record) return;
    expect(record.lastEventSignature).toBe(signatureFn(existingEvent));

    const newEvent = nodeFrom({ payload: { id: 'current' } });
    manager.persist('/', bundle, record, 'sig-1', newEvent);

    const storedEvent = runtime.document().get('/contracts/checkpoint/lastEvents/channelA');
    expect(storedEvent).toBeInstanceOf(BlueNode);
    expect(
      (storedEvent as BlueNode).getProperties()?.payload?.getProperties()?.id?.getValue(),
    ).toBe('current');
    expect(record.lastEventSignature).toBe('sig-1');

    const updatedMarker = bundle.marker(KEY_CHECKPOINT)! as ChannelEventCheckpoint;
    expect(updatedMarker.lastSignatures.channelA).toBe('sig-1');
  });

  it('detects duplicate events via signatures', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument());
    const bundle = ContractBundle.builder().build();
    const manager = new CheckpointManager(runtime, signatureFn);
    manager.ensureCheckpointMarker('/', bundle);
    const record = manager.findCheckpoint(bundle, 'missing');

    expect(manager.isDuplicate(record, 'sig')).toBe(false);

    const event = nodeFrom({ value: 'v1' });
    const checkpointMarker = bundle.marker(KEY_CHECKPOINT)! as ChannelEventCheckpoint;
    checkpointMarker.lastEvents.channelX = event;
    const existing = manager.findCheckpoint(bundle, 'channelX');
    if (!existing) throw new Error('expected record');
    manager.persist('/', bundle, existing, 'sig-x', event);
    expect(manager.isDuplicate(existing, 'sig-x')).toBe(true);
  });

  it('ignores persistence when record is null', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument());
    const bundle = ContractBundle.builder().build();
    const manager = new CheckpointManager(runtime, signatureFn);

    expect(() =>
      manager.persist('/', bundle, null, 'sig', nodeFrom({ value: 1 })),
    ).not.toThrow();
  });
});
