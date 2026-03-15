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

describe('ai steps execution', () => {
  it('emits call-operation request when using steps.askAI', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    // prettier-ignore
    const document = DocBuilder.doc()
      .name('AI Ask Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .ai('provider')
        .sessionId('provider-session')
        .permissionFrom('ownerChannel')
        .requestPermissionManually()
        .task('summarize')
          .instruction('Summarize user request')
          .done()
        .done()
      .operation(
        'askProvider',
        'ownerChannel',
        Number,
        'Ask provider',
        (steps) =>
          steps.askAI('provider', 'AskModel', (ask) =>
            ask.task('summarize').instruction('please summarize'),
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'ai ask runtime initialization failed',
    );

    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'askProvider',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'ai ask provider operation failed',
    );

    const callRequests = processed.triggeredEvents
      .map((event) => toOfficialJson(event))
      .filter((event) => event.type === 'MyOS/Call Operation Requested');

    expect(callRequests).toHaveLength(1);
    const callRequest = callRequests[0] as Record<string, unknown>;
    expect(callRequest.request).toMatchObject({
      requester: 'PROVIDER',
      taskName: 'summarize',
    });
  });

  it('can request ai permission and subscribe via ai namespace steps', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    // prettier-ignore
    const document = DocBuilder.doc()
      .name('AI Permission Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .ai('provider')
        .sessionId('provider-session')
        .permissionFrom('ownerChannel')
        .requestPermissionManually()
        .done()
      .operation(
        'wireProvider',
        'ownerChannel',
        Number,
        'Wire provider',
        (steps) =>
          steps.ai('provider').requestPermission().ai('provider').subscribe(),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'ai permission runtime initialization failed',
    );

    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'wireProvider',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'ai permission operation failed',
    );

    const eventTypes = processed.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );

    expect(eventTypes).toContain(
      'MyOS/Single Document Permission Grant Requested',
    );
    expect(eventTypes).toContain('MyOS/Subscribe to Session Requested');
  });
});
