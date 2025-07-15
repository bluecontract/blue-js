import { expect, describe, test } from 'vitest';
import { JsonObject } from '@blue-labs/shared-utils';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../../BlueDocumentProcessor';
import {
  repository as coreRepository,
  DocumentUpdateSchema,
} from '@blue-repository/core-dev';
import { prepareToProcess } from '../../testUtils';
import { createTimelineEntryEvent } from '../../utils/eventFactories';

function makeCounterWithOperationsDoc(): JsonObject {
  return {
    name: 'Counter with Operations Integration Test',
    counter: 5,
    contracts: {
      ownerChannel: {
        type: 'Timeline Channel',
        timelineId: 'owner-timeline',
      },

      // Operation definitions
      increment: {
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          description:
            'Represents a value by which counter will be incremented',
          type: 'Integer',
        },
      },

      decrement: {
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          description:
            'Represents a value by which counter will be decremented',
          type: 'Integer',
        },
      },

      reset: {
        type: 'Operation',
        channel: 'ownerChannel',
        request: {
          description: 'Optional value to reset counter to (defaults to 0)',
          type: 'Integer',
        },
      },

      // Operation implementations
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
                val: "${event.message.request + document('/counter')}",
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
                val: "${document('/counter') - event.message.request}",
              },
            ],
          },
        ],
      },

      resetImpl: {
        type: 'Sequential Workflow Operation',
        operation: 'reset',
        steps: [
          {
            type: 'Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/counter',
                val: '${event.message.request || 0}',
              },
            ],
          },
        ],
      },
    },
  };
}

describe('SequentialWorkflowOperationProcessor - Integration Tests', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);
  function timelineEvent(message: unknown) {
    return createTimelineEntryEvent('owner-timeline', message, blue);
  }

  function operationRequestEvent(operation: string, request: number) {
    return timelineEvent({
      type: 'Operation Request',
      operation,
      request,
    });
  }
  test('processes increment operation and updates counter', async () => {
    const doc = makeCounterWithOperationsDoc();
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const incrementEvent = operationRequestEvent('increment', 3);

    const { state, emitted } = await documentProcessor.processEvents(
      initializedState,
      [incrementEvent]
    );

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    // Counter should be incremented from 5 to 8
    expect(jsonState.counter).toBe(8);

    // Should emit a Document Update event
    const docUpdateEvt = emitted.find((e) =>
      blue.isTypeOf(e, DocumentUpdateSchema)
    );
    expect(docUpdateEvt).toBeDefined();
    const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
    expect(docUpdateEvtJson.path).toBe('/counter');
    expect(docUpdateEvtJson.val).toBe(8);
  });

  test('processes decrement operation and updates counter', async () => {
    const doc = makeCounterWithOperationsDoc();
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const decrementEvent = operationRequestEvent('decrement', 2);

    const { state, emitted } = await documentProcessor.processEvents(
      initializedState,
      [decrementEvent]
    );

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    // Counter should be decremented from 5 to 3
    expect(jsonState.counter).toBe(3);

    // Should emit a Document Update event
    const docUpdateEvt = emitted.find((e) =>
      blue.isTypeOf(e, DocumentUpdateSchema)
    );
    expect(docUpdateEvt).toBeDefined();
    const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
    expect(docUpdateEvtJson.path).toBe('/counter');
    expect(docUpdateEvtJson.val).toBe(3);
  });

  test('processes reset operation with specific value', async () => {
    const doc = makeCounterWithOperationsDoc();
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const resetEvent = operationRequestEvent('reset', 10);

    const { state, emitted } = await documentProcessor.processEvents(
      initializedState,
      [resetEvent]
    );

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    // Counter should be reset to 10
    expect(jsonState.counter).toBe(10);

    // Should emit a Document Update event
    const docUpdateEvt = emitted.find((e) =>
      blue.isTypeOf(e, DocumentUpdateSchema)
    );
    expect(docUpdateEvt).toBeDefined();
    const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
    expect(docUpdateEvtJson.path).toBe('/counter');
    expect(docUpdateEvtJson.val).toBe(10);
  });

  test('processes reset operation with default value (0)', async () => {
    const doc = makeCounterWithOperationsDoc();
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    // Create reset event with null/undefined request to test default behavior
    const resetEvent = timelineEvent({
      type: 'Operation Request',
      operation: 'reset',
      request: null,
      document: {
        blueId: '7UEBwTmRMfQ92rGt4vHkzPa8Ypd5KJsLNcA3FV6xDqbn',
      },
      allowNewerVersion: true,
    });

    const { state, emitted } = await documentProcessor.processEvents(
      initializedState,
      [resetEvent]
    );

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    // Counter should be reset to 0 (default value)
    expect(jsonState.counter).toBe(0);

    // Should emit a Document Update event
    const docUpdateEvt = emitted.find((e) =>
      blue.isTypeOf(e, DocumentUpdateSchema)
    );
    expect(docUpdateEvt).toBeDefined();
    const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
    expect(docUpdateEvtJson.path).toBe('/counter');
    expect(docUpdateEvtJson.val).toBe(0);
  });

  test('ignores operation request for non-matching operation name', async () => {
    const doc = makeCounterWithOperationsDoc();
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const nonMatchingEvent = operationRequestEvent('multiply', 2); // No 'multiply' operation defined

    const { state, emitted } = await documentProcessor.processEvents(
      initializedState,
      [nonMatchingEvent]
    );

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    // Counter should remain unchanged
    expect(jsonState.counter).toBe(5);

    // Should not emit any Document Update events
    const docUpdateEvts = emitted.filter((e) =>
      blue.isTypeOf(e, DocumentUpdateSchema)
    );
    expect(docUpdateEvts).toHaveLength(0);
  });

  test('processes multiple sequential operations correctly', async () => {
    const doc = makeCounterWithOperationsDoc();
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    // Increment by 5 (5 -> 10)
    const incrementEvent = operationRequestEvent('increment', 5);
    const result1 = await documentProcessor.processEvents(initializedState, [
      incrementEvent,
    ]);

    let jsonState = blue.nodeToJson(result1.state, 'simple') as any;
    expect(jsonState.counter).toBe(10);

    // Decrement by 3 (10 -> 7)
    const decrementEvent = operationRequestEvent('decrement', 3);
    const result2 = await documentProcessor.processEvents(result1.state, [
      decrementEvent,
    ]);

    jsonState = blue.nodeToJson(result2.state, 'simple') as any;
    expect(jsonState.counter).toBe(7);

    // Reset to 0 (7 -> 0)
    const resetEvent = operationRequestEvent('reset', 0);
    const result3 = await documentProcessor.processEvents(result2.state, [
      resetEvent,
    ]);

    jsonState = blue.nodeToJson(result3.state, 'simple') as any;
    expect(jsonState.counter).toBe(0);
  });

  test('handles complex operation with JavaScript Code step', async () => {
    const baseDoc = makeCounterWithOperationsDoc();
    const docWithComplexOperation = {
      ...baseDoc,
      contracts: {
        ...(baseDoc.contracts as JsonObject),

        // Add a complex operation that doubles and adds
        doubleAndAdd: {
          type: 'Operation',
          channel: 'ownerChannel',
          request: {
            description: 'Value to add after doubling the counter',
            type: 'Integer',
          },
        },

        doubleAndAddImpl: {
          type: 'Sequential Workflow Operation',
          operation: 'doubleAndAdd',
          steps: [
            {
              type: 'JavaScript Code',
              name: 'DoubleCounter',
              code: "var currentCounter = document('/counter'); return { doubled: currentCounter * 2 };",
            },
            {
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/counter',
                  val: '${steps.DoubleCounter.doubled + event.message.request}',
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
      }
    );

    const complexEvent = operationRequestEvent('doubleAndAdd', 3);

    const { state, emitted } = await documentProcessor.processEvents(
      initializedState,
      [complexEvent]
    );

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    // Counter should be doubled (5 * 2 = 10) then added 3 = 13
    expect(jsonState.counter).toBe(13);

    // Should emit a Document Update event
    const docUpdateEvt = emitted.find((e) =>
      blue.isTypeOf(e, DocumentUpdateSchema)
    );
    expect(docUpdateEvt).toBeDefined();
    const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
    expect(docUpdateEvtJson.path).toBe('/counter');
    expect(docUpdateEvtJson.val).toBe(13);
  });
});
