import { createBlue } from '../../test-support/blue.js';
import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { CheckpointManager } from '../checkpoint-manager.js';
import { CheckpointIdentityService } from '../checkpoint-identity-service.js';
import { ContractBundle } from '../contract-bundle.js';
import { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
import { KEY_CHECKPOINT } from '../../constants/processor-contract-constants.js';
import type { ChannelEventCheckpoint } from '../../model/index.js';

const blue = createBlue();

function createRootDocument(): BlueNode {
  return new BlueNode().setProperties({
    contracts: new BlueNode().setProperties({}),
  });
}

function nodeFrom(json: unknown): BlueNode {
  return blue.jsonValueToNode(json);
}

describe('CheckpointManager', () => {
  it('ensures checkpoint marker exists in bundle and document', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument(), blue);
    const bundle = ContractBundle.builder().build();
    const manager = new CheckpointManager(
      runtime,
      new CheckpointIdentityService(blue),
    );

    manager.ensureCheckpointMarker('/', bundle);

    const marker = bundle.marker(KEY_CHECKPOINT);
    expect(marker).toBeDefined();
    const stored = runtime.document().get('/contracts/checkpoint');
    expect(stored).toBeInstanceOf(BlueNode);
  });

  it('finds checkpoint records and persists updates', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument(), blue);
    const bundle = ContractBundle.builder().build();
    const manager = new CheckpointManager(
      runtime,
      new CheckpointIdentityService(blue),
    );
    manager.ensureCheckpointMarker('/', bundle);

    const marker = bundle.marker(KEY_CHECKPOINT)! as ChannelEventCheckpoint;
    const existingEvent = nodeFrom({ payload: { id: 'prior' } });
    if (!marker.lastEvents) {
      marker.lastEvents = {};
    }
    marker.lastEvents.channelA = existingEvent;

    const record = manager.findCheckpoint(bundle, 'channelA');
    expect(record).not.toBeNull();
    if (!record) return;
    expect(record.lastEventSignature).toBe(
      new CheckpointIdentityService(blue).identityFor(existingEvent).identity,
    );

    const newEvent = nodeFrom({ payload: { id: 'current' } });
    manager.persist('/', bundle, record, 'sig-1', newEvent);

    const storedEvent = runtime
      .document()
      .get('/contracts/checkpoint/lastEvents/channelA');
    expect(storedEvent).toBeInstanceOf(BlueNode);
    expect(
      (storedEvent as BlueNode)
        .getProperties()
        ?.payload?.getProperties()
        ?.id?.getValue(),
    ).toBe('current');
    expect(record.lastEventSignature).toBe('sig-1');

    const updatedMarker = bundle.marker(
      KEY_CHECKPOINT,
    )! as ChannelEventCheckpoint;
    expect(updatedMarker.lastEvents?.channelA).toBeInstanceOf(BlueNode);
  });

  it('detects duplicate events via signatures', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument(), blue);
    const bundle = ContractBundle.builder().build();
    const manager = new CheckpointManager(
      runtime,
      new CheckpointIdentityService(blue),
    );
    manager.ensureCheckpointMarker('/', bundle);
    const record = manager.findCheckpoint(bundle, 'missing');

    expect(manager.isDuplicate(record, 'sig')).toBe(false);

    const event = nodeFrom({ value: 'v1' });
    const checkpointMarker = bundle.marker(
      KEY_CHECKPOINT,
    )! as ChannelEventCheckpoint;
    if (!checkpointMarker.lastEvents) {
      checkpointMarker.lastEvents = {};
    }
    checkpointMarker.lastEvents.channelX = event;
    const existing = manager.findCheckpoint(bundle, 'channelX');
    if (!existing) throw new Error('expected record');
    manager.persist('/', bundle, existing, 'sig-x', event);
    expect(manager.isDuplicate(existing, 'sig-x')).toBe(true);
  });

  it('checkpointDefaultUsesContentBlueId', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument(), blue);
    const bundle = ContractBundle.builder().build();
    const identityService = new CheckpointIdentityService(blue);
    const manager = new CheckpointManager(runtime, identityService);
    manager.ensureCheckpointMarker('/', bundle);
    const record = manager.findCheckpoint(bundle, 'channel');
    const first = nodeFrom({ eventId: 'same', amount: 10 });
    const second = nodeFrom({ eventId: 'same', amount: 11 });

    manager.persist(
      '/',
      bundle,
      record,
      identityService.identityFor(first).identity,
      first,
    );

    const updated = manager.findCheckpoint(bundle, 'channel');
    expect(updated?.lastEventSignature).toBe(
      identityService.identityFor(first).identity,
    );
    expect(updated?.lastEventSignature).not.toBe('same');
    expect(
      manager.isDuplicate(
        updated,
        identityService.identityFor(second).identity,
      ),
    ).toBe(false);
  });

  it('checkpointStoresRawChannelKeyWithSlashAndUsesEscapedPointerForWrite', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument(), blue);
    const bundle = ContractBundle.builder().build();
    const identityService = new CheckpointIdentityService(blue);
    const manager = new CheckpointManager(runtime, identityService);
    manager.ensureCheckpointMarker('/', bundle);
    const record = manager.findCheckpoint(bundle, 'channel/with/slash');
    const event = nodeFrom({ payload: 'ok' });

    manager.persist(
      '/',
      bundle,
      record,
      identityService.identityFor(event).identity,
      event,
    );

    const marker = bundle.marker(KEY_CHECKPOINT) as ChannelEventCheckpoint;
    expect(marker.lastEvents?.['channel/with/slash']).toBeInstanceOf(BlueNode);
    const lastEvents = runtime
      .document()
      .get('/contracts/checkpoint/lastEvents');
    expect(lastEvents).toBeInstanceOf(BlueNode);
    expect(
      (lastEvents as BlueNode).getProperties()?.['channel/with/slash'],
    ).toBeInstanceOf(BlueNode);
  });

  it('ignores persistence when record is null', () => {
    const runtime = new DocumentProcessingRuntime(createRootDocument(), blue);
    const bundle = ContractBundle.builder().build();
    const manager = new CheckpointManager(
      runtime,
      new CheckpointIdentityService(blue),
    );

    expect(() =>
      manager.persist('/', bundle, null, 'sig', nodeFrom({ value: 1 })),
    ).not.toThrow();
  });
});
