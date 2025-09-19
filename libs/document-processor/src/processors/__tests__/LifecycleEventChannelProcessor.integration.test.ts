import { expect, describe, test, beforeEach } from 'vitest';
import { JsonObject } from '@blue-labs/shared-utils';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../../BlueDocumentProcessor';
import {
  repository as coreRepository,
  DocumentProcessingInitiatedSchema,
  DocumentUpdateSchema,
} from '@blue-repository/core-dev';
import { createTimelineEntryEvent } from '../../utils/eventFactories';

describe('LifecycleEventChannelProcessor - Integration Tests', () => {
  let blue: Blue;
  let documentProcessor: BlueDocumentProcessor;

  beforeEach(() => {
    blue = new Blue({
      repositories: [coreRepository],
    });
    documentProcessor = new BlueDocumentProcessor(blue);
  });

  function makeDocumentWithLifecycleChannels(): JsonObject {
    return {
      name: 'Document with Lifecycle Channels Integration Test',
      status: 'pending',
      contracts: {
        // Specific lifecycle channel - only catches Document Processing Initiated events
        initLifecycleChannel: {
          type: 'Lifecycle Event Channel',
          event: {
            type: 'Document Processing Initiated',
          },
        },

        // Sequential workflow that responds to lifecycle events
        initHandler: {
          type: 'Sequential Workflow',
          channel: 'initLifecycleChannel',
          steps: [
            {
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/status',
                  val: 'initialized',
                },
              ],
            },
          ],
        },

        // Timeline channel for other events
        mainTimeline: {
          type: 'Timeline Channel',
          timelineId: 'main-timeline',
        },

        // Another handler for timeline events
        timelineHandler: {
          type: 'Sequential Workflow',
          channel: 'mainTimeline',
          steps: [
            {
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/lastTimelineEvent',
                  val: '${event.message.name}',
                },
              ],
            },
          ],
        },
      },
    };
  }

  test('should emit lifecycle events during document initialization', async () => {
    const doc = makeDocumentWithLifecycleChannels();
    const docNode = blue.jsonValueToNode(doc);

    const resolvedDocNode = blue.resolve(docNode);

    const { state, emitted } = await documentProcessor.initialize(
      resolvedDocNode
    );

    // Verify the document was updated by the lifecycle handler
    const jsonState = blue.nodeToJson(state, 'simple') as any;
    expect(jsonState.status).toBe('initialized');

    // Should emit lifecycle events from channels
    const lifecycleEvents = emitted.filter((e) =>
      blue.isTypeOf(e, DocumentProcessingInitiatedSchema)
    );
    expect(lifecycleEvents.length).toBe(1);

    // Should emit document update event from the sequential workflow
    const docUpdateEvents = emitted.filter((e) =>
      blue.isTypeOf(e, DocumentUpdateSchema)
    );
    expect(docUpdateEvents.length).toBe(1);

    const statusUpdate = docUpdateEvents.find(
      (e) => e.get('/path') === '/status'
    );
    expect(statusUpdate).toBeDefined();
    expect(statusUpdate!.get('/val')).toBe('initialized');
  });

  test('should not interfere with regular event processing', async () => {
    const doc = makeDocumentWithLifecycleChannels();
    const docNode = blue.jsonValueToNode(doc);

    // First initialize the document
    const initResult = await documentProcessor.initialize(docNode);
    expect((blue.nodeToJson(initResult.state, 'simple') as any).status).toBe(
      'initialized'
    );

    // Then process a regular timeline event
    const timelineEvent = createTimelineEntryEvent(
      'main-timeline',
      {
        name: 'User Action',
        action: 'click',
      },
      blue
    );

    const { state: finalState } = await documentProcessor.processEvents(
      initResult.state,
      [timelineEvent]
    );

    const finalJsonState = blue.nodeToJson(finalState, 'simple') as any;

    // Timeline event should have been processed
    expect(finalJsonState.lastTimelineEvent).toBe('User Action');

    // Lifecycle processing should not have interfered
    expect(finalJsonState.status).toBe('initialized');
  });

  test('should filter lifecycle events based on patterns', async () => {
    const docWithPatternChannel: JsonObject = {
      name: 'Pattern Filtering Test',
      contracts: {
        // Channel that only matches events with specific context
        patternChannel: {
          type: 'Lifecycle Event Channel',
          event: {
            type: 'Document Processing Initiated',
            context: {
              environment: 'production',
            },
          },
        },

        // Handler for pattern channel
        patternHandler: {
          type: 'Sequential Workflow',
          channel: 'patternChannel',
          steps: [
            {
              type: 'Update Document',
              changeset: [
                {
                  op: 'add',
                  path: '/patternMatched',
                  val: true,
                },
              ],
            },
          ],
        },
      },
    };

    const docNode = blue.jsonValueToNode(docWithPatternChannel);

    // Initialize document - this should NOT trigger the pattern channel
    // because the default lifecycle event doesn't have the required context
    const { state } = await documentProcessor.initialize(docNode);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    // The pattern should not have matched, so patternMatched should not exist
    expect(jsonState.patternMatched).toBeUndefined();
  });
});
