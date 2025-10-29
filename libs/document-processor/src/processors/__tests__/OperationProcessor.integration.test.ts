import { expect, describe, test, beforeEach } from 'vitest';
import { JsonObject } from '@blue-labs/shared-utils';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../../BlueDocumentProcessor';
import {
  repository as coreRepository,
  DocumentUpdateSchema,
} from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import { prepareToProcess } from '../../testUtils';
import { createTimelineEntryEvent } from '../../utils/eventFactories';

describe('OperationProcessor - Integration Tests', () => {
  describe('Timeline Channel', () => {
    const blue = new Blue({
      repositories: [coreRepository],
    });
    const documentProcessor = new BlueDocumentProcessor(blue);

    function createOperationRequestEvent(operation: string, request: unknown) {
      return createTimelineEntryEvent(
        'owner-timeline',
        {
          type: 'Operation Request',
          operation,
          request,
        },
        blue,
      );
    }

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
              type: 'Text',
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

    test('should process increment operation request through timeline channel', async () => {
      const doc = makeDocumentWithOperations();
      const { initializedState } = await prepareToProcess(doc, {
        blue,
        documentProcessor,
      });

      const incrementEvent = createOperationRequestEvent('increment', 5);

      const { state, emitted } = await documentProcessor.processEvents(
        initializedState,
        [incrementEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Counter should be incremented from 10 to 15
      expect(jsonState.counter).toBe(15);

      // Should emit document update event
      const docUpdateEvt = emitted.find((e) =>
        blue.isTypeOf(e, DocumentUpdateSchema),
      );
      expect(docUpdateEvt).toBeDefined();
      const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
      expect(docUpdateEvtJson.path).toBe('/counter');
      expect(docUpdateEvtJson.val).toBe(15);
    });

    test('should process decrement operation request', async () => {
      const doc = makeDocumentWithOperations();
      const { initializedState } = await prepareToProcess(doc, {
        blue,
        documentProcessor,
      });

      const decrementEvent = createOperationRequestEvent('decrement', 3);

      const { state, emitted } = await documentProcessor.processEvents(
        initializedState,
        [decrementEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Counter should be decremented from 10 to 7
      expect(jsonState.counter).toBe(7);

      // Should emit document update event
      const docUpdateEvt = emitted.find((e) =>
        blue.isTypeOf(e, DocumentUpdateSchema),
      );
      expect(docUpdateEvt).toBeDefined();
      const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
      expect(docUpdateEvtJson.path).toBe('/counter');
      expect(docUpdateEvtJson.val).toBe(7);
    });

    test('should process string operation request', async () => {
      const doc = makeDocumentWithOperations();
      const { initializedState } = await prepareToProcess(doc, {
        blue,
        documentProcessor,
      });

      const statusEvent = createOperationRequestEvent('setStatus', 'active');

      const { state, emitted } = await documentProcessor.processEvents(
        initializedState,
        [statusEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Status should be updated from 'idle' to 'active'
      expect(jsonState.status).toBe('active');

      // Should emit document update event
      const docUpdateEvt = emitted.find((e) =>
        blue.isTypeOf(e, DocumentUpdateSchema),
      );
      expect(docUpdateEvt).toBeDefined();
      const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
      expect(docUpdateEvtJson.path).toBe('/status');
      expect(docUpdateEvtJson.val).toBe('active');
    });

    test('should ignore operation requests for non-existent operations', async () => {
      const doc = makeDocumentWithOperations();
      const { initializedState } = await prepareToProcess(doc, {
        blue,
        documentProcessor,
      });

      const nonExistentEvent = createOperationRequestEvent('multiply', 2);

      const { state, emitted } = await documentProcessor.processEvents(
        initializedState,
        [nonExistentEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Document should remain unchanged
      expect(jsonState.counter).toBe(10);
      expect(jsonState.status).toBe('idle');

      // Should not emit document update events
      const docUpdateEvts = emitted.filter((e) =>
        blue.isTypeOf(e, DocumentUpdateSchema),
      );
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

      const { initializedState } = await prepareToProcess(docWithWrongChannel, {
        blue,
        documentProcessor,
      });

      // Send event to wrong timeline
      const wrongTimelineEvent = createTimelineEntryEvent(
        'wrong-timeline',
        {
          type: 'Operation Request',
          operation: 'increment',
          request: 5,
        },
        blue,
      );

      const { state } = await documentProcessor.processEvents(
        initializedState,
        [wrongTimelineEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Counter should remain unchanged because operation doesn't match channel
      expect(jsonState.counter).toBe(10);
    });

    test('should process multiple sequential operation requests', async () => {
      const doc = makeDocumentWithOperations();
      const { initializedState } = await prepareToProcess(doc, {
        blue,
        documentProcessor,
      });

      // Increment by 5 (10 -> 15)
      const incrementEvent = createOperationRequestEvent('increment', 5);
      let result = await documentProcessor.processEvents(initializedState, [
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
              type: 'Text',
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

      const { initializedState } = await prepareToProcess(
        docWithComplexOperation,
        {
          blue,
          documentProcessor,
        },
      );

      const complexEvent = createOperationRequestEvent(
        'updateUser',
        JSON.stringify({
          name: 'John Doe',
          age: 30,
        }),
      );

      const { state, emitted } = await documentProcessor.processEvents(
        initializedState,
        [complexEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // User data should be updated
      expect(jsonState.user.userName).toBe('John Doe');
      expect(jsonState.user.age).toBe(30);

      // Should emit document update events
      const docUpdateEvts = emitted.filter((e) =>
        blue.isTypeOf(e, DocumentUpdateSchema),
      );
      expect(docUpdateEvts.length).toBe(2); // One for name, one for age
    });

    test('should ignore non-Operation Request timeline messages', async () => {
      const doc = makeDocumentWithOperations();
      const { initializedState } = await prepareToProcess(doc, {
        blue,
        documentProcessor,
      });

      // Send a regular timeline message that's not an operation request
      const regularEvent = createTimelineEntryEvent(
        'owner-timeline',
        null,
        blue,
      );

      const { state } = await documentProcessor.processEvents(
        initializedState,
        [regularEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Document should remain unchanged
      expect(jsonState.counter).toBe(10);
      expect(jsonState.status).toBe('idle');
    });

    test('should ignore operation request when request type mismatches definition', async () => {
      const doc = makeDocumentWithOperations();
      const { initializedState } = await prepareToProcess(doc, {
        blue,
        documentProcessor,
      });

      // "increment" expects Integer, but we send a Text
      const badTypeEvent = createOperationRequestEvent('increment', '5');

      const { state, emitted } = await documentProcessor.processEvents(
        initializedState,
        [badTypeEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Document should remain unchanged
      expect(jsonState.counter).toBe(10);
      expect(jsonState.status).toBe('idle');

      // Should not emit document update events
      const docUpdateEvts = emitted.filter((e) =>
        blue.isTypeOf(e, DocumentUpdateSchema),
      );
      expect(docUpdateEvts.length).toBe(0);
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

      const { initializedState } = await prepareToProcess(docWithMyOSTimeline, {
        blue,
        documentProcessor,
      });

      // Create MyOS Timeline Event with operation request
      const myosTimelineEvent = blue.jsonValueToNode({
        type: 'MyOS Timeline Entry',
        timeline: { timelineId: 'myos-timeline' },
        message: {
          type: 'Operation Request',
          operation: 'increment',
          request: 3,
        },
      });

      const { state, emitted } = await documentProcessor.processEvents(
        initializedState,
        [myosTimelineEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Counter should be incremented from 5 to 8
      expect(jsonState.counter).toBe(8);

      // Should emit document update event
      const docUpdateEvt = emitted.find((e) =>
        blue.isTypeOf(e, DocumentUpdateSchema),
      );
      expect(docUpdateEvt).toBeDefined();
      const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
      expect(docUpdateEvtJson.path).toBe('/counter');
      expect(docUpdateEvtJson.val).toBe(8);
    });

    test('should ignore MyOS operation request when request type mismatches definition', async () => {
      const docWithMyOSTimeline: JsonObject = {
        name: 'MyOS Timeline Bad Type Test',
        counter: 5,
        contracts: {
          myosChannel: {
            type: 'MyOS Timeline Channel',
            timelineId: 'myos-timeline',
          },
          increment: {
            type: 'Operation',
            channel: 'myosChannel',
            request: {
              description: 'Value to increment counter by',
              type: 'Integer',
            },
          },
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

      const { initializedState } = await prepareToProcess(docWithMyOSTimeline, {
        blue,
        documentProcessor,
      });

      // Send Text instead of Integer
      const myosBadTypeEvent = blue.jsonValueToNode({
        type: 'MyOS Timeline Entry',
        timeline: { timelineId: 'myos-timeline' },
        message: {
          type: 'Operation Request',
          operation: 'increment',
          request: '3',
        },
      });

      const { state, emitted } = await documentProcessor.processEvents(
        initializedState,
        [myosBadTypeEvent],
      );

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      // Counter should not change
      expect(jsonState.counter).toBe(5);

      // Should not emit document update events
      const docUpdateEvts = emitted.filter((e) =>
        blue.isTypeOf(e, DocumentUpdateSchema),
      );
      expect(docUpdateEvts.length).toBe(0);
    });
  });
});
