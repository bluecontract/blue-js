import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import {
  createTestBlue,
  createTestDocumentProcessor,
  expectSuccess,
  operationRequestEvent,
  storedDocumentBlueId,
} from '../../../test-harness/runtime.js';
import { toOfficialJson } from '../../core/serialization.js';

describe('ai integration execution', () => {
  it('emits permission request on init for ai integration', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    // prettier-ignore
    const document = DocBuilder.doc()
      .name('AI Init Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .ai('provider')
        .sessionId('provider-session')
        .permissionFrom('ownerChannel')
        .done()
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'ai init document failed',
    );
    const eventTypes = initialized.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );
    expect(eventTypes).toContain(
      'MyOS/Single Document Permission Grant Requested',
    );
  });

  it('normalizes type-like event aliases for AI permission triggers', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    // prettier-ignore
    const document = DocBuilder.doc()
      .name('AI Event Permission Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .ai('provider')
        .sessionId('provider-session')
        .permissionFrom('ownerChannel')
        .requestPermissionOnEvent(String)
        .done()
      .operation(
        'emitTextTrigger',
        'ownerChannel',
        Number,
        'emit text trigger',
        (steps) => steps.emitType('EmitTextTrigger', String),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'ai event permission initialization failed',
    );
    const initializedEventTypes = initialized.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );
    expect(initializedEventTypes).not.toContain(
      'MyOS/Single Document Permission Grant Requested',
    );

    const documentBlueId = storedDocumentBlueId(initialized.document);
    const processed = await expectSuccess(
      processor.processDocument(
        initialized.document.clone(),
        operationRequestEvent(blue, {
          operation: 'emitTextTrigger',
          request: 1,
          timelineId: 'owner-timeline',
          documentBlueId,
          allowNewerVersion: false,
        }),
      ),
      'ai event permission operation failed',
    );

    const processedEventTypes = processed.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );
    expect(processedEventTypes).toContain(
      'MyOS/Single Document Permission Grant Requested',
    );
    expect(toOfficialJson(processed.document).ai.provider.status).toBe(
      'pending',
    );
  });

  it('normalizes task expected response aliases in emitted AI requests', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    // prettier-ignore
    const document = DocBuilder.doc()
      .name('AI Expected Response Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .ai('provider')
        .sessionId('provider-session')
        .permissionFrom('ownerChannel')
        .requestPermissionManually()
        .task('summarize')
          .instruction('Summarize response')
          .expects(String)
          .expects('  Text  ')
          .done()
        .done()
      .operation(
        'askProvider',
        'ownerChannel',
        Number,
        'emit ai request',
        (steps) =>
          steps.askAI('provider', 'AskProvider', (ask) => ask.task('summarize')),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'ai expected response initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const processed = await expectSuccess(
      processor.processDocument(
        initialized.document.clone(),
        operationRequestEvent(blue, {
          operation: 'askProvider',
          request: 1,
          timelineId: 'owner-timeline',
          documentBlueId,
          allowNewerVersion: false,
        }),
      ),
      'ai expected response operation failed',
    );

    const requestEvent = processed.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find((event) => event.type === 'MyOS/Call Operation Requested') as {
      request: {
        expectedResponses: Array<{ type: string }>;
        taskName?: string;
      };
    };

    expect(requestEvent.request.taskName).toBe('summarize');
    expect(requestEvent.request.expectedResponses).toEqual([
      { type: 'Text' },
      { type: 'Text' },
    ]);
  });

  it('applies requester/task/name matching for AI response listeners', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    // prettier-ignore
    const document = DocBuilder.doc()
      .name('AI Response Runtime')
      .field('/taskHandled', false)
      .field('/namedHandled', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .ai('provider')
        .sessionId('provider-session')
        .permissionFrom('ownerChannel')
        .requestPermissionManually()
        .requesterId('PROVIDER')
        .subscriptionId('SUB_PROVIDER')
        .task('summarize')
          .instruction('Summarize response')
          .done()
        .done()
      .onAIResponseForTask(
        'provider',
        'handleSummaryResponse',
        'Conversation/Response',
        ' summarize ',
        (steps) => steps.replaceValue('SetTaskHandled', '/taskHandled', true),
      )
      .onAINamedResponse(
        'provider',
        'handleSummaryNamedResponse',
        'summary-ready',
        ' summarize ',
        (steps) => steps.replaceValue('SetNamedHandled', '/namedHandled', true),
      )
      .operation(
        'emitMismatchedResponses',
        'ownerChannel',
        Number,
        'emit mismatched ai responses',
        (steps) =>
          steps
            .emitType(
              'EmitMismatchedTaskUpdate',
              'MyOS/Subscription Update',
              (payload) => {
                payload.put('subscriptionId', 'SUB_PROVIDER');
                payload.put('update', {
                  type: 'Conversation/Response',
                  context: {
                    message: 'mismatched',
                  },
                  inResponseTo: {
                    incomingEvent: {
                      requester: 'OTHER',
                      taskName: 'summarize',
                    },
                  },
                });
              },
            )
            .emitType(
              'EmitMismatchedNamedUpdate',
              'MyOS/Subscription Update',
              (payload) => {
                payload.put('subscriptionId', 'SUB_PROVIDER');
                payload.put('update', {
                  type: 'Common/Named Event',
                  name: 'summary-ready',
                  context: {
                    message: 'mismatched',
                  },
                  inResponseTo: {
                    incomingEvent: {
                      requester: 'OTHER',
                      taskName: 'summarize',
                    },
                  },
                });
              },
            ),
      )
      .operation(
        'emitMatchingResponses',
        'ownerChannel',
        Number,
        'emit matching ai responses',
        (steps) =>
          steps
            .emitType(
              'EmitMatchingTaskUpdate',
              'MyOS/Subscription Update',
              (payload) => {
                payload.put('subscriptionId', 'SUB_PROVIDER');
                payload.put('update', {
                  type: 'Conversation/Response',
                  context: {
                    message: 'matching',
                  },
                  inResponseTo: {
                    incomingEvent: {
                      requester: 'PROVIDER',
                      taskName: 'summarize',
                    },
                  },
                });
              },
            )
            .emitType(
              'EmitMatchingNamedUpdate',
              'MyOS/Subscription Update',
              (payload) => {
                payload.put('subscriptionId', 'SUB_PROVIDER');
                payload.put('update', {
                  type: 'Common/Named Event',
                  name: 'summary-ready',
                  context: {
                    message: 'matching',
                  },
                  inResponseTo: {
                    incomingEvent: {
                      requester: 'PROVIDER',
                      taskName: 'summarize',
                    },
                  },
                });
              },
            ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'ai response runtime initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const mismatched = await expectSuccess(
      processor.processDocument(
        initialized.document.clone(),
        operationRequestEvent(blue, {
          operation: 'emitMismatchedResponses',
          request: 1,
          timelineId: 'owner-timeline',
          documentBlueId,
          allowNewerVersion: false,
        }),
      ),
      'ai mismatched response operation failed',
    );
    expect(toOfficialJson(mismatched.document).taskHandled).toBe(false);
    expect(toOfficialJson(mismatched.document).namedHandled).toBe(false);

    const matching = await expectSuccess(
      processor.processDocument(
        mismatched.document.clone(),
        operationRequestEvent(blue, {
          operation: 'emitMatchingResponses',
          request: 1,
          timelineId: 'owner-timeline',
          documentBlueId,
          allowNewerVersion: false,
        }),
      ),
      'ai matching response operation failed',
    );

    expect(toOfficialJson(matching.document).taskHandled).toBe(true);
    expect(toOfficialJson(matching.document).namedHandled).toBe(true);
  });
});
