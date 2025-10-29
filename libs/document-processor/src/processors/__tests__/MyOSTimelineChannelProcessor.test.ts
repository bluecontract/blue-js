import { MyOSTimelineChannelProcessor } from '../MyOSTimelineChannelProcessor';
import { EventNode, ProcessingContext } from '../../types';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';

describe('MyOSTimelineChannelProcessor', () => {
  const blue = new Blue({
    repositories: [coreRepository, myosRepository],
  });
  let processor: MyOSTimelineChannelProcessor;
  let mockContext: ProcessingContext;

  const createTimelineChannelNode = (config?: {
    timelineId?: string;
    accountId?: string;
    email?: string;
  }) => {
    const nodeData: any = {
      type: 'MyOS Timeline Channel',
    };

    if (config?.timelineId) nodeData.timelineId = config.timelineId;
    if (config?.accountId) nodeData.accountId = config.accountId;
    if (config?.email) nodeData.email = config.email;

    return blue.jsonValueToNode(nodeData);
  };

  const createTimelineEntryEvent = (
    config: {
      timelineId?: string;
    } = {},
  ) => {
    const nodeData: any = {
      type: 'MyOS Timeline Entry',
      id: 12345,
      timestamp: 1748598263552984,
      content: 'Test timeline entry',
    };

    if (config?.timelineId) {
      nodeData.timeline = { timelineId: config.timelineId };
    }

    return blue.jsonValueToNode(nodeData);
  };

  beforeEach(() => {
    processor = new MyOSTimelineChannelProcessor();

    mockContext = {
      getBlue: vi.fn().mockReturnValue(blue),
      emitEvent: vi.fn(),
      resolvePath: vi.fn(),
      getNodePath: vi.fn(),
    } as any;
  });

  describe('supports', () => {
    describe('timeline ID matching', () => {
      it('should return true for matching timeline IDs', () => {
        const channelNode = createTimelineChannelNode({
          timelineId: 'timeline-123',
        });
        const timelineEntry = createTimelineEntryEvent({
          timelineId: 'timeline-123',
        });

        const event: EventNode = {
          payload: timelineEntry,
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(true);
      });

      it('should return false for non-matching timeline IDs', () => {
        const channelNode = createTimelineChannelNode({
          timelineId: 'timeline-123',
        });
        const timelineEntry = createTimelineEntryEvent({
          timelineId: 'timeline-456',
        });

        const event: EventNode = {
          payload: timelineEntry,
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(false);
      });

      it('should return false when channel has timeline ID but entry does not', () => {
        const channelNode = createTimelineChannelNode({
          timelineId: 'timeline-123',
        });
        const timelineEntry = createTimelineEntryEvent();

        const event: EventNode = {
          payload: timelineEntry,
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(false);
      });
    });

    describe('non-timeline events', () => {
      it('should return false for non-timeline entry events', () => {
        const channelNode = createTimelineChannelNode({
          timelineId: 'timeline-123',
        });
        const nonTimelineEvent = blue.jsonValueToNode({
          type: 'MyOS Agent Event',
          agentId: 'test-agent',
          id: 12345,
          timestamp: 1748598263552984,
        });

        const event: EventNode = {
          payload: nonTimelineEvent,
          source: 'external',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(false);
      });
    });

    describe('channel source events', () => {
      it('should return false for channel source events', () => {
        const channelNode = createTimelineChannelNode({
          timelineId: 'timeline-123',
        });
        const timelineEntry = createTimelineEntryEvent({
          timelineId: 'timeline-123',
        });

        const event: EventNode = {
          payload: timelineEntry,
          source: 'channel',
        };

        const result = processor.supports(event, channelNode, mockContext);
        expect(result).toBe(false);
      });
    });
  });

  describe('handle', () => {
    it('should emit timeline entry event with channel source and path', () => {
      const timelineEntry = createTimelineEntryEvent();
      const channelNode = createTimelineChannelNode({
        timelineId: 'timeline-123',
      });

      const event: EventNode = {
        payload: timelineEntry,
        source: 'external',
      };

      processor.handle(event, channelNode, mockContext, 'timelineChannel');

      expect(mockContext.emitEvent).toHaveBeenCalledWith({
        payload: timelineEntry,
        channelName: 'timelineChannel',
        source: 'channel',
      });
    });

    it('should not emit event for non-timeline entry events', () => {
      const nonTimelineEvent = blue.jsonValueToNode({
        type: 'MyOS Agent Event',
        agentId: 'test-agent',
        id: 12345,
        timestamp: 1748598263552984,
      });
      const channelNode = createTimelineChannelNode({
        timelineId: 'timeline-123',
      });

      const event: EventNode = {
        payload: nonTimelineEvent,
        source: 'external',
      };

      processor.handle(event, channelNode, mockContext, 'someChannel');

      expect(mockContext.emitEvent).not.toHaveBeenCalled();
    });
  });
});
