import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import {
  createTestBlue,
  createTestDocumentProcessor,
  expectSuccess,
} from '../../../test-harness/runtime.js';
import { toOfficialJson } from '../../core/serialization.js';

describe('ai integration execution', () => {
  it('emits permission request on init for ai integration', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

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
});
