import { createBlue } from '../../test-support/blue.js';
import { BlueNode } from '@blue-labs/language';
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
  processingTerminatedMarkerSchema,
} from '../markers/index.js';

describe('contract model schemas', () => {
  const blue = createBlue();

  function deserialize(json: unknown): BlueNode {
    return blue.jsonValueToNode(json);
  }

  it('converts DocumentUpdateChannel contracts', () => {
    const node = deserialize({
      type: 'Document Update Channel',
      path: '/documents/foo',
      key: 'documentUpdate',
      order: 7,
    });

    const dto = blue.nodeToSchemaOutput(node, documentUpdateChannelSchema);

    expect(dto.path).toBe('/documents/foo');
    expect(dto.key).toBe('documentUpdate');
    expect(dto.order).toBe(7);
  });

  it('converts EmbeddedNodeChannel contracts with child path', () => {
    const node = deserialize({
      type: 'Embedded Node Channel',
      childPath: '/child/alpha',
    });

    const dto = blue.nodeToSchemaOutput(node, embeddedNodeChannelSchema);

    expect(dto.childPath).toBe('/child/alpha');
  });

  it('converts Lifecycle and Triggered channel contracts without extra fields', () => {
    const lifecycle = blue.nodeToSchemaOutput(
      deserialize({ type: 'Lifecycle Event Channel' }),
      lifecycleChannelSchema
    );
    const triggered = blue.nodeToSchemaOutput(
      deserialize({ type: 'Triggered Event Channel' }),
      triggeredEventChannelSchema
    );

    expect(lifecycle).toEqual({});
    expect(triggered).toEqual({});
  });

  it('converts ProcessEmbedded markers with readonly paths', () => {
    const node = deserialize({
      type: 'Process Embedded',
      paths: ['/child/a', '/child/b'],
    });

    const dto = blue.nodeToSchemaOutput(node, processEmbeddedMarkerSchema);

    expect(Array.isArray(dto.paths)).toBe(true);
    expect(dto.paths).toEqual(['/child/a', '/child/b']);
  });

  it('converts Initialization markers', () => {
    const node = deserialize({
      type: 'Processing Initialized Marker',
      documentId: 'doc-123',
    });

    const dto = blue.nodeToSchemaOutput(node, initializationMarkerSchema);

    expect(dto.documentId).toBe('doc-123');
  });

  it('converts ProcessingTerminated markers', () => {
    const node = deserialize({
      type: 'Processing Terminated Marker',
      cause: 'BoundaryViolation',
      reason: 'Test',
    });

    const dto = blue.nodeToSchemaOutput(node, processingTerminatedMarkerSchema);

    expect(dto.cause).toBe('BoundaryViolation');
    expect(dto.reason).toBe('Test');
  });

  it('converts ChannelEventCheckpoint markers preserving BlueNodes', () => {
    const node = deserialize({
      type: 'Channel Event Checkpoint',
      lastEvents: {
        channelA: {
          payload: 'data',
        },
      },
      lastSignatures: {
        channelA: 'sig-123',
      },
    });

    const dto = blue.nodeToSchemaOutput(node, channelEventCheckpointSchema);

    expect(dto.lastSignatures?.channelA).toBe('sig-123');
    const eventNode = dto.lastEvents?.channelA ?? null;
    expect(eventNode).toBeInstanceOf(BlueNode);
    expect(eventNode?.getProperties()?.payload?.getValue()).toBe('data');
  });
});
