import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OperationProcessor } from '../OperationProcessor';
import { EventNode, ProcessingContext } from '../../types';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { createTimelineEntryEvent } from '../../utils/eventFactories';

describe('OperationProcessor', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  let processor: OperationProcessor;
  let mockContext: ProcessingContext;

  const timelineEntryEvent = (timelineId: string, message: unknown) => {
    return createTimelineEntryEvent(timelineId, message, blue);
  };

  beforeEach(() => {
    processor = new OperationProcessor();

    mockContext = {
      getBlue: vi.fn().mockReturnValue(blue),
      emitEvent: vi.fn(),
    } as any;
  });

  describe('supports', () => {
    it('should return true for matching operation request from correct channel', () => {
      // Create an Operation contract node
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      // Create a matching timeline event with operation request
      const event: EventNode = {
        payload: timelineEntryEvent('owner-timeline', {
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        }),
        source: 'channel',
        channelName: 'ownerChannel',
      };

      const result = processor.supports(
        event,
        operationNode,
        mockContext,
        'increment'
      );
      expect(result).toBe(true);
    });

    it('should return false for non-channel events', () => {
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      const event: EventNode = {
        payload: timelineEntryEvent('owner-timeline', {
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        }),
        source: 'external', // Not from channel
        channelName: 'ownerChannel',
      };

      const result = processor.supports(
        event,
        operationNode,
        mockContext,
        'increment'
      );
      expect(result).toBe(false);
    });

    it('should return false for non-matching channel names', () => {
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      const event: EventNode = {
        payload: timelineEntryEvent('other-timeline', {
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        }),
        source: 'channel',
        channelName: 'differentChannel', // Different channel
      };

      const result = processor.supports(
        event,
        operationNode,
        mockContext,
        'increment'
      );
      expect(result).toBe(false);
    });

    it('should return false for non-matching operation names', () => {
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      const event: EventNode = {
        payload: timelineEntryEvent('owner-timeline', {
          type: 'Operation Request',
          operation: 'decrement', // Different operation
          request: 5,
        }),
        source: 'channel',
        channelName: 'ownerChannel',
      };

      const result = processor.supports(
        event,
        operationNode,
        mockContext,
        'increment' // Contract name doesn't match
      );
      expect(result).toBe(false);
    });

    it('should return false when operation is null/undefined', () => {
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      const event: EventNode = {
        payload: timelineEntryEvent('owner-timeline', {
          type: 'Operation Request',
          operation: null, // Null operation
          request: 5,
        }),
        source: 'channel',
        channelName: 'ownerChannel',
      };

      const result = processor.supports(
        event,
        operationNode,
        mockContext,
        'increment'
      );
      expect(result).toBe(false);
    });

    it('should return false for non-Timeline Entry events', () => {
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      const event: EventNode = {
        payload: blue.jsonValueToNode({
          type: 'Timeline Entry',
        }),
        source: 'channel',
        channelName: 'ownerChannel',
      };

      const result = processor.supports(
        event,
        operationNode,
        mockContext,
        'increment'
      );
      expect(result).toBe(false);
    });

    it('should return false when timeline entry has no message', () => {
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      const event: EventNode = {
        payload: timelineEntryEvent('owner-timeline', null),
        source: 'channel',
        channelName: 'ownerChannel',
      };

      const result = processor.supports(
        event,
        operationNode,
        mockContext,
        'increment'
      );
      expect(result).toBe(false);
    });

    it('should return false for timeline entry with non-Operation Request message', () => {
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      const event: EventNode = {
        payload: timelineEntryEvent('owner-timeline', null),
        source: 'channel',
        channelName: 'ownerChannel',
      };

      const result = processor.supports(
        event,
        operationNode,
        mockContext,
        'increment'
      );
      expect(result).toBe(false);
    });
  });

  describe('handle', () => {
    it('should emit event with correct payload and channel information', async () => {
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      const event: EventNode = {
        payload: timelineEntryEvent('owner-timeline', {
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        }),
        source: 'channel',
        channelName: 'ownerChannel',
      };

      await processor.handle(event, operationNode, mockContext, 'increment');

      expect(mockContext.emitEvent).toHaveBeenCalledWith({
        payload: event.payload,
        channelName: 'increment',
        source: 'channel',
      });
    });

    it('should emit event even when contractName is undefined', async () => {
      const operationNode = blue.jsonValueToNode({
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Integer',
        },
      });

      const event: EventNode = {
        payload: timelineEntryEvent('owner-timeline', {
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        }),
        source: 'channel',
        channelName: 'ownerChannel',
      };

      await processor.handle(event, operationNode, mockContext); // No contract name

      expect(mockContext.emitEvent).toHaveBeenCalledWith({
        payload: event.payload,
        channelName: undefined,
        source: 'channel',
      });
    });
  });
});
