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

describe('access step helpers execution', () => {
  it('emits permission and subscription requests through access steps', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Access Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_ACCESS')
      .subscriptionId('SUB_ACCESS')
      .done()
      .operation(
        'bootstrapAccess',
        'ownerChannel',
        Number,
        'bootstrap access',
        (steps) =>
          steps
            .access('counterAccess')
            .requestPermission()
            .access('counterAccess')
            .subscribe(),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'access runtime initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'bootstrapAccess',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'access bootstrap operation failed',
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
