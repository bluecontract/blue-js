import { describe, it, expect, vi } from 'vitest';
import { LifecycleEventChannelProcessor } from '../LifecycleEventChannelProcessor';
import { Blue } from '@blue-labs/language';
import { createDocumentProcessingInitiatedEvent } from '../../utils/eventFactories';
import { BlueDocumentProcessor } from '../../BlueDocumentProcessor';

describe('LifecycleEventChannelProcessor', () => {
  const blue = new Blue();

  it('should emit Document Processing Initiated event during initialization', async () => {
    const processor = new BlueDocumentProcessor(blue);

    // Create a simple document without any contracts
    const doc = blue.jsonValueToNode({
      contracts: {},
    });

    const result = await processor.initialize(doc);

    // The Document Processing Initiated event should be emitted even without contracts
    // This tests the new initialization mechanism
    expect(result.state).toBeDefined();
    expect(result.emitted).toHaveLength(1);
  });

  it('should process Document Processing Initiated events correctly with LifecycleEventChannelProcessor', () => {
    const processor = new LifecycleEventChannelProcessor();

    // Create a lifecycle event
    const lifecycleEvent = {
      payload: createDocumentProcessingInitiatedEvent(),
      source: 'external' as const,
    };

    // Create a mock document node for the channel config
    const mockChannelNode = blue.jsonValueToNode({
      event: {
        type: 'Document Processing Initiated',
      },
    });

    // Create a mock processing context
    const mockContext = {
      getBlue: () => blue,
      emitEvent: vi.fn(),
    } as any;

    // Test that the processor supports this event
    const supports = processor.supports(
      lifecycleEvent,
      mockChannelNode,
      mockContext
    );
    expect(supports).toBe(true);

    // Test that the processor handles the event correctly
    processor.handle(
      lifecycleEvent,
      mockChannelNode,
      mockContext,
      'testChannel'
    );
    expect(mockContext.emitEvent).toHaveBeenCalledWith({
      payload: lifecycleEvent.payload,
      channelName: 'testChannel',
      source: 'channel',
    });
  });

  it('should not support non-lifecycle events', () => {
    const processor = new LifecycleEventChannelProcessor();

    // Create a non-lifecycle event
    const nonLifecycleEvent = {
      payload: { type: 'Some Other Event' },
      source: 'external' as const,
    };

    const mockChannelNode = blue.jsonValueToNode({});
    const mockContext = { getBlue: () => blue } as any;

    // Test that the processor does not support this event
    const supports = processor.supports(
      nonLifecycleEvent,
      mockChannelNode,
      mockContext
    );
    expect(supports).toBe(false);
  });

  it('should not support channel events', () => {
    const processor = new LifecycleEventChannelProcessor();

    // Create a channel event (which should be rejected by baseSupports)
    const channelEvent = {
      payload: createDocumentProcessingInitiatedEvent(),
      source: 'channel' as const,
    };

    const mockChannelNode = blue.jsonValueToNode({});
    const mockContext = { getBlue: () => blue } as any;

    // Test that the processor does not support channel events
    const supports = processor.supports(
      channelEvent,
      mockChannelNode,
      mockContext
    );
    expect(supports).toBe(false);
  });
});
