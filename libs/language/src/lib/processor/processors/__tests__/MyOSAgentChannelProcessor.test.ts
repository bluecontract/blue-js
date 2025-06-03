import { MyOSAgentChannelProcessor } from '../MyOSAgentChannelProcessor';
import { EventNode, ProcessingContext } from '../../types';
import { NodeDeserializer } from '../../../model';
import { Blue } from '../../../Blue';

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
