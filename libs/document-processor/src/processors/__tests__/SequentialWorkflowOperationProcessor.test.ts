import { SequentialWorkflowOperationProcessor } from '../SequentialWorkflowOperationProcessor';
import { SequentialWorkflowProcessor } from '../SequentialWorkflowProcessor';
import { EventNode, ProcessingContext } from '../../types';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';

describe('SequentialWorkflowOperationProcessor', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  let processor: SequentialWorkflowOperationProcessor;
  let mockSequentialWorkflowProcessor: SequentialWorkflowProcessor;
  let mockContext: ProcessingContext;

  // Mock Sequential Workflow Operation node
  const mockSequentialWorkflowOperationNode = blue.jsonValueToNode({
    type: 'Sequential Workflow Operation',
    operation: 'increment',
    steps: [
      {
        type: 'Update Document',
        changeset: [
          {
            op: 'replace',
            path: '/counter',
            val: "${event.request + document('/counter')}",
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    mockSequentialWorkflowProcessor = {
      supports: vi.fn(),
      handle: vi.fn(),
    } as any;

    processor = new SequentialWorkflowOperationProcessor(
      mockSequentialWorkflowProcessor,
    );

    mockContext = {
      getBlue: vi.fn().mockReturnValue(blue),
    } as any;
  });

  describe('supports', () => {
    it('should return true for channel events with matching operation name', () => {
      const event: EventNode = {
        payload: blue.jsonValueToNode({
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        }),
        source: 'channel',
        channelName: 'increment',
      };

      const result = processor.supports(
        event,
        mockSequentialWorkflowOperationNode,
        mockContext,
      );
      expect(result).toBe(true);
    });

    it('should return false for non-channel events', () => {
      const event: EventNode = {
        payload: blue.jsonValueToNode({
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        }),
        source: 'external', // Not from channel
        channelName: 'increment',
      };

      const result = processor.supports(
        event,
        mockSequentialWorkflowOperationNode,
        mockContext,
      );
      expect(result).toBe(false);
    });

    it('should return false for non-matching operation names', () => {
      const event: EventNode = {
        payload: blue.jsonValueToNode({
          type: 'Operation Request',
          operation: 'decrement',
          request: 5,
        }),
        source: 'channel',
        channelName: 'decrement', // channelName doesn't match node operation
      };

      const result = processor.supports(
        event,
        mockSequentialWorkflowOperationNode,
        mockContext,
      );
      expect(result).toBe(false);
    });

    it('should return false when operation or channelName are undefined/null', () => {
      const nodeWithNullOperation = blue.jsonValueToNode({
        type: 'Sequential Workflow Operation',
        operation: null,
        steps: [],
      });

      const event: EventNode = {
        payload: blue.jsonValueToNode({
          type: 'Operation Request',
          operation: null,
          request: 5,
        }),
        source: 'channel',
        channelName: undefined,
      };

      const result = processor.supports(
        event,
        nodeWithNullOperation,
        mockContext,
      );
      expect(result).toBe(false);
    });
  });

  describe('handle', () => {
    it('should delegate to SequentialWorkflowProcessor', async () => {
      const event: EventNode = {
        payload: blue.jsonValueToNode({
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        }),
        source: 'channel',
        channelName: 'increment',
      };

      const path = 'incrementImpl';

      await processor.handle(
        event,
        mockSequentialWorkflowOperationNode,
        mockContext,
        path,
      );

      expect(mockSequentialWorkflowProcessor.handle).toHaveBeenCalledWith(
        event,
        mockSequentialWorkflowOperationNode,
        mockContext,
        path,
      );
    });

    it('should propagate errors from SequentialWorkflowProcessor', async () => {
      // Mock console.error to silence error logs during test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

      const error = new Error('Sequential workflow processing failed');
      (mockSequentialWorkflowProcessor.handle as any).mockRejectedValue(error);

      const event: EventNode = {
        payload: blue.jsonValueToNode({
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        }),
        source: 'channel',
        channelName: 'increment',
      };

      await expect(
        processor.handle(
          event,
          mockSequentialWorkflowOperationNode,
          mockContext,
          'incrementImpl',
        ),
      ).rejects.toThrow('Sequential workflow processing failed');

      // Restore console.error
      consoleSpy.mockRestore();
    });
  });
});
