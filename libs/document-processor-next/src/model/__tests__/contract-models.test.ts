import { Blue, BlueNode } from '@blue-labs/language';

import {
  documentUpdateChannelSchema,
  embeddedNodeChannelSchema,
  lifecycleChannelSchema,
  triggeredEventChannelSchema,
} from '../channels/index.js';
import {
  channelEventCheckpointSchema,
  initializationMarkerSchema,
  processEmbeddedMarkerSchema,
  processingFailureMarkerSchema,
  processingTerminatedMarkerSchema,
} from '../markers/index.js';

describe('contract model schemas', () => {
  const blue = new Blue();

  function deserialize(json: unknown): BlueNode {
    return blue.jsonValueToNode(json);
  }

  it('converts DocumentUpdateChannel contracts', () => {
    const node = deserialize({
      type: { blueId: 'DocumentUpdateChannel' },
      path: { value: '/documents/foo' },
      key: { value: 'documentUpdate' },
      order: { value: 7 },
    });

    const dto = blue.nodeToSchemaOutput(node, documentUpdateChannelSchema);

    expect(dto.path).toBe('/documents/foo');
    expect(dto.key).toBe('documentUpdate');
    expect(dto.order).toBe(7);
  });

  it('converts EmbeddedNodeChannel contracts with child path', () => {
    const node = deserialize({
      type: { blueId: 'EmbeddedNodeChannel' },
      childPath: { value: '/child/alpha' },
    });

    const dto = blue.nodeToSchemaOutput(node, embeddedNodeChannelSchema);

    expect(dto.childPath).toBe('/child/alpha');
  });

  it('converts Lifecycle and Triggered channel contracts without extra fields', () => {
    const lifecycle = blue.nodeToSchemaOutput(
      deserialize({ type: { blueId: 'LifecycleChannel' } }),
      lifecycleChannelSchema,
    );
    const triggered = blue.nodeToSchemaOutput(
      deserialize({ type: { blueId: 'TriggeredEventChannel' } }),
      triggeredEventChannelSchema,
    );

    expect(lifecycle).toEqual({});
    expect(triggered).toEqual({});
  });

  it('converts ProcessEmbedded markers with readonly paths', () => {
    const node = deserialize({
      type: { blueId: 'ProcessEmbedded' },
      paths: {
        items: [
          { value: '/child/a' },
          { value: '/child/b' },
        ],
      },
    });

    const dto = blue.nodeToSchemaOutput(node, processEmbeddedMarkerSchema);

    expect(Array.isArray(dto.paths)).toBe(true);
    expect(dto.paths).toEqual(['/child/a', '/child/b']);
  });

  it('converts Initialization markers', () => {
    const node = deserialize({
      type: { blueId: 'InitializationMarker' },
      documentId: { value: 'doc-123' },
    });

    const dto = blue.nodeToSchemaOutput(node, initializationMarkerSchema);

    expect(dto.documentId).toBe('doc-123');
  });

  it('converts ProcessingTerminated markers', () => {
    const node = deserialize({
      type: { blueId: 'ProcessingTerminatedMarker' },
      cause: { value: 'BoundaryViolation' },
      reason: { value: 'Test' },
    });

    const dto = blue.nodeToSchemaOutput(node, processingTerminatedMarkerSchema);

    expect(dto.cause).toBe('BoundaryViolation');
    expect(dto.reason).toBe('Test');
  });

  it('converts ProcessingFailure markers', () => {
    const node = deserialize({
      type: { blueId: 'ProcessingFailureMarker' },
      code: { value: 'Fatal' },
      reason: { value: 'Oops' },
    });

    const dto = blue.nodeToSchemaOutput(node, processingFailureMarkerSchema);

    expect(dto.code).toBe('Fatal');
    expect(dto.reason).toBe('Oops');
  });

  it('converts ChannelEventCheckpoint markers preserving BlueNodes', () => {
    const node = deserialize({
      type: { blueId: 'ChannelEventCheckpoint' },
      lastEvents: {
        channelA: {
          payload: { value: 'data' },
        },
      },
      lastSignatures: {
        channelA: { value: 'sig-123' },
      },
    });

    const dto = blue.nodeToSchemaOutput(node, channelEventCheckpointSchema);

    expect(dto.lastSignatures?.channelA).toBe('sig-123');
    const eventNode = dto.lastEvents?.channelA ?? null;
    expect(eventNode).toBeInstanceOf(BlueNode);
    expect(eventNode?.getProperties()?.payload?.getValue()).toBe('data');
  });
});
