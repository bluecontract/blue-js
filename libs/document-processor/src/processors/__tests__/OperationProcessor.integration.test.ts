import { expect, describe, test, beforeEach } from 'vitest';
import { JsonObject } from '@blue-labs/shared-utils';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';

describe('OperationProcessor - Integration Tests', () => {
  describe('Timeline Channel', () => {
    let blue: Blue;
    let documentProcessor: BlueDocumentProcessor;

    beforeEach(() => {
      blue = new Blue({
        repositories: [coreRepository],
      });
      documentProcessor = new BlueDocumentProcessor(blue);
    });

    function makeDocumentWithOperations(): JsonObject {
      return {
        name: 'Document with Operations Integration Test',
        counter: 10,
        status: 'idle',
        contracts: {
          // Timeline channel for events
          ownerChannel: {
            type: 'Timeline Channel',
            timelineId: 'owner-timeline',
          },

          // Operation definitions - the OperationProcessor routes these to operation-named channels
          increment: {
            type: 'Operation',
            channel: 'ownerChannel',
            request: {
              description: 'Value to increment counter by',
              type: 'Integer',
            },
          },

          decrement: {
            type: 'Operation',
            channel: 'ownerChannel',
            request: {
              description: 'Value to decrement counter by',
              type: 'Integer',
            },
          },

          setStatus: {
            type: 'Operation',
            channel: 'ownerChannel',
            request: {
              description: 'New status to set',
              type: 'String',
            },
          },

          // Sequential Workflow Operations that implement the operations
          incrementImpl: {
            type: 'Sequential Workflow Operation',
            operation: 'increment',
            steps: [
              {
                type: 'Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/counter',
                    val: '${document("/counter") + event.message.request}',
                  },
                ],
              },
            ],
          },

          decrementImpl: {
            type: 'Sequential Workflow Operation',
            operation: 'decrement',
            steps: [
              {
                type: 'Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/counter',
                    val: '${document("/counter") - event.message.request}',
                  },
                ],
              },
            ],
          },

          statusImpl: {
            type: 'Sequential Workflow Operation',
            operation: 'setStatus',
            steps: [
              {
                type: 'Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/status',
                    val: '${event.message.request}',
                  },
                ],
              },
            ],
          },
        },
      };
    }

    function createTimelineEvent(message: unknown) {
      return {
        type: 'Timeline Entry',
        timeline: { timelineId: 'owner-timeline' },
        message,
      };
    }

    function createOperationRequestEvent(operation: string, request: unknown) {
      return createTimelineEvent({
        type: 'Operation Request',
        operation,
        request,
      });
    }

    test('should process increment operation request through timeline channel', async () => {
      const doc = makeDocumentWithOperations();
      const docNode = blue.jsonValueToNode(doc);

      const incrementEvent = createOperationRequestEvent('increment', 5);

      const { state, emitted } = await documentProcessor.processEvents(
        docNode,
        [incrementEvent]
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Counter should be incremented from 10 to 15
      expect(jsonState.counter).toBe(15);

      // Should emit document update event
      const docUpdateEvt = emitted.find((e) => e.type === 'Document Update');
      expect(docUpdateEvt).toBeDefined();
      expect(docUpdateEvt!.path).toBe('/counter');
      expect(docUpdateEvt!.val).toBe(15);
    });

    test('should process decrement operation request', async () => {
      const doc = makeDocumentWithOperations();
      const docNode = blue.jsonValueToNode(doc);

      const decrementEvent = createOperationRequestEvent('decrement', 3);

      const { state, emitted } = await documentProcessor.processEvents(
        docNode,
        [decrementEvent]
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Counter should be decremented from 10 to 7
      expect(jsonState.counter).toBe(7);

      // Should emit document update event
      const docUpdateEvt = emitted.find((e) => e.type === 'Document Update');
      expect(docUpdateEvt).toBeDefined();
      expect(docUpdateEvt!.path).toBe('/counter');
      expect(docUpdateEvt!.val).toBe(7);
    });

    test('should process string operation request', async () => {
      const doc = makeDocumentWithOperations();
      const docNode = blue.jsonValueToNode(doc);

      const statusEvent = createOperationRequestEvent('setStatus', 'active');

      const { state, emitted } = await documentProcessor.processEvents(
        docNode,
        [statusEvent]
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Status should be updated from 'idle' to 'active'
      expect(jsonState.status).toBe('active');

      // Should emit document update event
      const docUpdateEvt = emitted.find((e) => e.type === 'Document Update');
      expect(docUpdateEvt).toBeDefined();
      expect(docUpdateEvt!.path).toBe('/status');
      expect(docUpdateEvt!.val).toBe('active');
    });

    test('should ignore operation requests for non-existent operations', async () => {
      const doc = makeDocumentWithOperations();
      const docNode = blue.jsonValueToNode(doc);

      const nonExistentEvent = createOperationRequestEvent('multiply', 2);

      const { state, emitted } = await documentProcessor.processEvents(
        docNode,
        [nonExistentEvent]
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Document should remain unchanged
      expect(jsonState.counter).toBe(10);
      expect(jsonState.status).toBe('idle');

      // Should not emit any operation events
      const operationEvents = emitted.filter(
        (e) => e.source === 'channel' && e.channelName === 'multiply'
      );
      expect(operationEvents.length).toBe(0);

      // Should not emit document update events
      const docUpdateEvts = emitted.filter((e) => e.type === 'Document Update');
      expect(docUpdateEvts.length).toBe(0);
    });

    test('should ignore operation requests from wrong channel', async () => {
      const docWithWrongChannel: JsonObject = {
        ...makeDocumentWithOperations(),
        contracts: {
          // Different timeline channel
          wrongChannel: {
            type: 'Timeline Channel',
            timelineId: 'wrong-timeline',
          },

          // Operation still references the non-existent ownerChannel
          increment: {
            type: 'Operation',
            channel: 'ownerChannel', // This channel doesn't exist
            request: {
              type: 'Integer',
            },
          },

          incrementHandler: {
            type: 'Sequential Workflow',
            channel: 'increment',
            steps: [
              {
                type: 'Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/counter',
                    val: '${document("/counter") + event.message.request}',
                  },
                ],
              },
            ],
          },
        },
      };

      const docNode = blue.jsonValueToNode(docWithWrongChannel);

      // Send event to wrong timeline
      const wrongTimelineEvent = {
        type: 'Timeline Entry',
        timeline: { timelineId: 'wrong-timeline' },
        message: {
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        },
      };

      const { state, emitted } = await documentProcessor.processEvents(
        docNode,
        [wrongTimelineEvent]
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Counter should remain unchanged because operation doesn't match channel
      expect(jsonState.counter).toBe(10);

      // Should not emit operation events
      const operationEvents = emitted.filter(
        (e) => e.source === 'channel' && e.channelName === 'increment'
      );
      expect(operationEvents.length).toBe(0);
    });

    test('should process multiple sequential operation requests', async () => {
      const doc = makeDocumentWithOperations();
      const docNode = blue.jsonValueToNode(doc);

      // Increment by 5 (10 -> 15)
      const incrementEvent = createOperationRequestEvent('increment', 5);
      let result = await documentProcessor.processEvents(docNode, [
        incrementEvent,
      ]);

      let jsonState = blue.nodeToJson(result.state, 'simple') as any;
      expect(jsonState.counter).toBe(15);

      // Decrement by 3 (15 -> 12)
      const decrementEvent = createOperationRequestEvent('decrement', 3);
      result = await documentProcessor.processEvents(result.state, [
        decrementEvent,
      ]);

      jsonState = blue.nodeToJson(result.state, 'simple') as any;
      expect(jsonState.counter).toBe(12);

      // Change status
      const statusEvent = createOperationRequestEvent('setStatus', 'completed');
      result = await documentProcessor.processEvents(result.state, [
        statusEvent,
      ]);

      jsonState = blue.nodeToJson(result.state, 'simple') as any;
      expect(jsonState.counter).toBe(12);
      expect(jsonState.status).toBe('completed');
    });

    test('should handle complex operation with nested request data', async () => {
      const docWithComplexOperation: JsonObject = {
        name: 'Complex Operation Test',
        user: {
          userName: 'trol',
          age: 0,
        },
        contracts: {
          ownerChannel: {
            type: 'Timeline Channel',
            timelineId: 'owner-timeline',
          },

          updateUser: {
            type: 'Operation',
            channel: 'ownerChannel',
            request: {
              description: 'User data to update',
              // Use a simpler type definition to avoid validation issues
              type: 'String',
            },
          },

          updateUserImpl: {
            type: 'Sequential Workflow Operation',
            operation: 'updateUser',
            steps: [
              {
                type: 'JavaScript Code',
                name: 'ParseUserData',
                code: 'var userData = JSON.parse(event.message.request); return { name: userData.name, age: userData.age };',
              },
              {
                type: 'Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/user/userName',
                    val: '${steps.ParseUserData.name}',
                  },
                  {
                    op: 'replace',
                    path: '/user/age',
                    val: '${steps.ParseUserData.age}',
                  },
                ],
              },
            ],
          },
        },
      };

      const docNode = blue.jsonValueToNode(docWithComplexOperation);

      const complexEvent = createOperationRequestEvent(
        'updateUser',
        JSON.stringify({
          name: 'John Doe',
          age: 30,
        })
      );

      const { state, emitted } = await documentProcessor.processEvents(
        docNode,
        [complexEvent]
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // User data should be updated
      expect(jsonState.user.userName).toBe('John Doe');
      expect(jsonState.user.age).toBe(30);

      // Should emit document update events
      const docUpdateEvts = emitted.filter((e) => e.type === 'Document Update');
      expect(docUpdateEvts.length).toBe(2); // One for name, one for age
    });

    test('should ignore non-Operation Request timeline messages', async () => {
      const doc = makeDocumentWithOperations();
      const docNode = blue.jsonValueToNode(doc);

      // Send a regular timeline message that's not an operation request
      const regularEvent = createTimelineEvent({
        type: 'User Message',
        content: 'Hello world',
      });

      const { state, emitted } = await documentProcessor.processEvents(
        docNode,
        [regularEvent]
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Document should remain unchanged
      expect(jsonState.counter).toBe(10);
      expect(jsonState.status).toBe('idle');

      // Should not emit any operation events
      const operationEvents = emitted.filter((e) => e.source === 'channel');
      const operationEventNames = operationEvents.map((e) => e.channelName);
      expect(operationEventNames).not.toContain('increment');
      expect(operationEventNames).not.toContain('decrement');
      expect(operationEventNames).not.toContain('setStatus');
    });
  });

  describe('MyOS Timeline Channel', () => {
    let blue: Blue;
    let documentProcessor: BlueDocumentProcessor;

    beforeEach(() => {
      blue = new Blue({
        repositories: [coreRepository, myosRepository],
      });
      documentProcessor = new BlueDocumentProcessor(blue);
    });

    test('should be compatible with MyOS Timeline Channel and MyOS Timeline Event', async () => {
      const docWithMyOSTimeline: JsonObject = {
        name: 'MyOS Timeline Integration Test',
        counter: 5,
        contracts: {
          // MyOS Timeline channel for events
          myosChannel: {
            type: 'MyOS Timeline Channel',
            timelineId: 'myos-timeline',
          },

          // Operation that uses MyOS Timeline Channel
          increment: {
            type: 'Operation',
            channel: 'myosChannel',
            request: {
              description: 'Value to increment counter by',
              type: 'Integer',
            },
          },

          // Sequential Workflow Operation that implements the operation
          incrementImpl: {
            type: 'Sequential Workflow Operation',
            operation: 'increment',
            steps: [
              {
                type: 'Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/counter',
                    val: '${document("/counter") + event.message.request}',
                  },
                ],
              },
            ],
          },
        },
      };

      const docNode = blue.jsonValueToNode(docWithMyOSTimeline);

      // Create MyOS Timeline Event with operation request
      const myosTimelineEvent = {
        type: 'MyOS Timeline Entry',
        timeline: { timelineId: 'myos-timeline' },
        message: {
          type: 'Operation Request',
          operation: 'increment',
          request: 3,
        },
      };

      const { state, emitted } = await documentProcessor.processEvents(
        docNode,
        [myosTimelineEvent]
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Counter should be incremented from 5 to 8
      expect(jsonState.counter).toBe(8);

      // Should emit document update event
      const docUpdateEvt = emitted.find((e) => e.type === 'Document Update');
      expect(docUpdateEvt).toBeDefined();
      expect(docUpdateEvt!.path).toBe('/counter');
      expect(docUpdateEvt!.val).toBe(8);
    });
  });
});
