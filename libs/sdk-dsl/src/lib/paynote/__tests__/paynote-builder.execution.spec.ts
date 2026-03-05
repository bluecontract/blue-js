import { describe, expect, it } from 'vitest';
import {
  createTestBlue,
  createTestDocumentProcessor,
  expectSuccess,
} from '../../../test-harness/runtime.js';
import { toOfficialJson } from '../../core/serialization.js';
import { PayNotes } from '../paynotes.js';

describe('paynote execution', () => {
  it('emits capture lock request on initialization', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const payNote = PayNotes.payNote('Init Capture')
      .currency('USD')
      .amountMinor(5000)
      .capture()
      .lockOnInit()
      .done()
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(payNote),
      'paynote initialization failed',
    );

    const triggeredEventTypes = initialized.triggeredEvents.map(
      (triggeredEvent) => toOfficialJson(triggeredEvent).type as string,
    );
    expect(triggeredEventTypes).toContain(
      'PayNote/Card Transaction Capture Lock Requested',
    );
  });
});
