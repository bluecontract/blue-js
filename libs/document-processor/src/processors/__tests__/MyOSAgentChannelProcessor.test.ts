import { MyOSAgentChannelProcessor } from '../MyOSAgentChannelProcessor';
import { EventNode, ProcessingContext } from '../../types';
import { NodeDeserializer, Blue } from '@blue-labs/language';

describe('MyOSAgentChannelProcessor', () => {
  let processor: MyOSAgentChannelProcessor;
  let mockContext: ProcessingContext;
  const mockNode = NodeDeserializer.deserialize({
    type: 'MyOS Agent Channel',
    agent: {
      agentId: 'test-1234',
    },
    event: {
      type: 'SomeEventType',
      payload: { foo: 'bar' },
    },
  });

  beforeEach(() => {
    processor = new MyOSAgentChannelProcessor();

    mockContext = {
      getBlue: vi.fn().mockReturnValue(new Blue()),
      emitEvent: vi.fn(),
      resolvePath: vi.fn(),
      getNodePath: vi.fn(),
    } as any;
  });

  describe('supports', () => {
    it('should return true for matching MyOS Agent Event with correct agentId', () => {
      const event: EventNode = {
        payload: {
          type: 'MyOS Agent Event',
          agentId: 'test-1234',
          id: 18440,
          timestamp: 1748598263552984,
          event: {
            type: 'SomeEventType',
            payload: { foo: 'bar' },
          },
        },
        source: 'external',
      };

      const result = processor.supports(event, mockNode, mockContext);
      expect(result).toBe(true);
    });

    it('should return false for non-matching agentId', () => {
      const event: EventNode = {
        payload: {
          type: 'MyOS Agent Event',
          agentId: 'different-agent',
          id: 18440,
          timestamp: 1748598263552984,
          event: { type: 'SomeEventType', payload: { foo: 'bar' } },
        },
        source: 'external',
      };

      const result = processor.supports(event, mockNode, mockContext);
      expect(result).toBe(false);
    });

    it('should return false for channel events', () => {
      const event: EventNode = {
        payload: {
          type: 'MyOS Agent Event',
          agentId: 'test-1234',
          id: 18440,
          timestamp: 1748598263552984,
          event: { type: 'SomeEventType', payload: { foo: 'bar' } },
        },
        source: 'channel',
      };

      const result = processor.supports(event, mockNode, mockContext);
      expect(result).toBe(false);
    });

    describe('event matching with deepContains', () => {
      it('should return true when event payload exactly matches channel event pattern', () => {
        const channelNode = NodeDeserializer.deserialize({
          type: 'MyOS Agent Channel',
          agent: { agentId: 'test-1234' },
          event: {
            type: 'UserAction',
            payload: { action: 'click', target: 'button' },
          },
        });

        const event: EventNode = {
          payload: {
            type: 'MyOS Agent Event',
            agentId: 'test-1234',
            id: 18440,
            timestamp: 1748598263552984,
            event: {
              type: 'UserAction',
              payload: { action: 'click', target: 'button' },
            },
          },
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(true);
      });

      it('should return true when event payload contains channel event pattern (superset)', () => {
        const channelNode = NodeDeserializer.deserialize({
          type: 'MyOS Agent Channel',
          agent: { agentId: 'test-1234' },
          event: {
            type: 'UserAction',
            payload: { action: 'click' },
          },
        });

        const event: EventNode = {
          payload: {
            type: 'MyOS Agent Event',
            agentId: 'test-1234',
            id: 18440,
            timestamp: 1748598263552984,
            event: {
              type: 'UserAction',
              payload: { action: 'click', target: 'button', timestamp: 123456 },
            },
          },
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when event payload does not contain channel event pattern', () => {
        const channelNode = NodeDeserializer.deserialize({
          type: 'MyOS Agent Channel',
          agent: { agentId: 'test-1234' },
          event: {
            type: 'UserAction',
            payload: { action: 'click', target: 'button' },
          },
        });

        const event: EventNode = {
          payload: {
            type: 'MyOS Agent Event',
            agentId: 'test-1234',
            id: 18440,
            timestamp: 1748598263552984,
            event: {
              type: 'UserAction',
              payload: { action: 'hover' }, // Missing 'target' and different 'action'
            },
          },
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(false);
      });

      it('should return false when event type does not match channel event type', () => {
        const channelNode = NodeDeserializer.deserialize({
          type: 'MyOS Agent Channel',
          agent: { agentId: 'test-1234' },
          event: {
            type: 'UserAction',
            payload: { action: 'click' },
          },
        });

        const event: EventNode = {
          payload: {
            type: 'MyOS Agent Event',
            agentId: 'test-1234',
            id: 18440,
            timestamp: 1748598263552984,
            event: {
              type: 'SystemEvent', // Different event type
              payload: { action: 'click' },
            },
          },
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(false);
      });

      it('should return true when channel event pattern is empty/undefined', () => {
        const channelNode = NodeDeserializer.deserialize({
          type: 'MyOS Agent Channel',
          agent: { agentId: 'test-1234' },
          // No event specified - should match any event
        });

        const event: EventNode = {
          payload: {
            type: 'MyOS Agent Event',
            agentId: 'test-1234',
            id: 18440,
            timestamp: 1748598263552984,
            event: {
              type: 'AnyEventType',
              payload: { some: 'data' },
            },
          },
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(true);
      });

      it('should return true when both channel and event have no event data', () => {
        const channelNode = NodeDeserializer.deserialize({
          type: 'MyOS Agent Channel',
          agent: { agentId: 'test-1234' },
          // No event specified
        });

        const event: EventNode = {
          payload: {
            type: 'MyOS Agent Event',
            agentId: 'test-1234',
            id: 18440,
            timestamp: 1748598263552984,
            // No event specified
          },
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(true);
      });

      it('should handle nested object matching correctly', () => {
        const channelNode = NodeDeserializer.deserialize({
          type: 'MyOS Agent Channel',
          agent: { agentId: 'test-1234' },
          event: {
            type: 'ComplexEvent',
            payload: {
              user: { id: 'user123' },
              metadata: { source: 'web' },
            },
          },
        });

        const event: EventNode = {
          payload: {
            type: 'MyOS Agent Event',
            agentId: 'test-1234',
            id: 18440,
            timestamp: 1748598263552984,
            event: {
              type: 'ComplexEvent',
              payload: {
                user: { id: 'user123', name: 'John Doe' },
                metadata: { source: 'web', timestamp: 123456 },
                extra: 'data',
              },
            },
          },
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when nested object values do not match', () => {
        const channelNode = NodeDeserializer.deserialize({
          type: 'MyOS Agent Channel',
          agent: { agentId: 'test-1234' },
          event: {
            type: 'ComplexEvent',
            payload: {
              user: { id: 'user123' },
              metadata: { source: 'web' },
            },
          },
        });

        const event: EventNode = {
          payload: {
            type: 'MyOS Agent Event',
            agentId: 'test-1234',
            id: 18440,
            timestamp: 1748598263552984,
            event: {
              type: 'ComplexEvent',
              payload: {
                user: { id: 'user456' }, // Different user ID
                metadata: { source: 'mobile' }, // Different source
              },
            },
          },
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(false);
      });

      it('should return false when channel has event defined but incoming event has no event', () => {
        const channelNode = NodeDeserializer.deserialize({
          type: 'MyOS Agent Channel',
          agent: { agentId: 'test-1234' },
          event: {
            type: 'UserAction',
            payload: { action: 'click', target: 'button' },
          },
        });

        const event: EventNode = {
          payload: {
            type: 'MyOS Agent Event',
            agentId: 'test-1234',
            id: 18440,
            timestamp: 1748598263552984,
            // No event field - incoming event has no event data
          },
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(false);
      });
    });
  });

  describe('handle', () => {
    it('should emit event with channel source and channelName', () => {
      const event: EventNode = {
        payload: {
          type: 'MyOS Agent Event',
          agentId: 'test-1234',
          id: 18440,
          timestamp: 1748598263552984,
          event: { type: 'SomeEventType', payload: { foo: 'bar' } },
        },
        source: 'external',
      };

      processor.handle(event, mockNode, mockContext, 'someAgentChannel');

      expect(mockContext.emitEvent).toHaveBeenCalledWith({
        payload: event.payload,
        channelName: 'someAgentChannel',
        source: 'channel',
      });
    });
  });
});
