import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
} from '../test-support/runtime.js';

describe('sdk e2e: participants orchestration', () => {
  it('initializes participants orchestration marker and emits add/remove participant events', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Participants orchestration e2e')
      .contract('participantsOrchestration', {
        type: 'MyOS/MyOS Participants Orchestration',
      })
      .onInit('bootstrap', (steps) =>
        steps
          .myOs()
          .addParticipant('guestChannel', 'guest@example.com')
          .myOs()
          .removeParticipant('legacyChannel'),
      )
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    expect(processor.isInitialized(initialized.document)).toBe(true);
    expect(initialized.triggeredEvents.length).toBeGreaterThan(0);
  });
});
