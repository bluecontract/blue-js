import { describe, expect, it } from 'vitest';
import {
  createTestBlue,
  createTestDocumentProcessor,
  expectSuccess,
  operationRequestEvent,
  storedDocumentBlueId,
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

  it('emits reserve requested event from operation-triggered paynote flow', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const payNote = PayNotes.payNote('Reserve Flow')
      .currency('USD')
      .amountMinor(2000)
      .reserve()
      .requestOnOperation('requestReserve', 'payerChannel', 'Reserve funds')
      .done()
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(payNote),
      'reserve paynote initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'requestReserve',
      request: 1,
      timelineId: 'payer-timeline',
      allowNewerVersion: false,
      documentBlueId,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'reserve paynote operation failed',
    );

    const eventTypes = processed.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );
    expect(eventTypes).toContain('PayNote/Reserve Funds Requested');
  });
});
