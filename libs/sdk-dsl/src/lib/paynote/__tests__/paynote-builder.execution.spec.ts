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

  it('emits capture unlock and partial capture events from advanced operation flows', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const payNote = PayNotes.payNote('Advanced Runtime')
      .currency('USD')
      .amountMinor(2200)
      .capture()
      .unlockOnOperation('unlockCapture', 'guarantorChannel', 'Unlock capture')
      .requestPartialOnOperation(
        'capturePartial',
        'guarantorChannel',
        'event.message.request',
        'Request partial capture',
      )
      .done()
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(payNote),
      'advanced paynote initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const unlockResponse = await expectSuccess(
      processor.processDocument(
        initialized.document.clone(),
        operationRequestEvent(blue, {
          operation: 'unlockCapture',
          request: 1,
          timelineId: 'guarantor-timeline',
          allowNewerVersion: false,
          documentBlueId,
        }),
      ),
      'unlock capture operation failed',
    );
    const unlockTypes = unlockResponse.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );
    expect(unlockTypes).toContain(
      'PayNote/Card Transaction Capture Unlock Requested',
    );

    const partialResponse = await expectSuccess(
      processor.processDocument(
        unlockResponse.document.clone(),
        operationRequestEvent(blue, {
          operation: 'capturePartial',
          request: '900',
          timelineId: 'guarantor-timeline',
          allowNewerVersion: false,
          documentBlueId,
        }),
      ),
      'capture partial operation failed',
    );
    const partialEvent = partialResponse.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find((event) => event.type === 'PayNote/Capture Funds Requested');
    expect(partialEvent).toBeDefined();
    expect(partialEvent).toMatchObject({
      amount: '900',
    });
  });

  it('emits release request on initialization when configured', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const payNote = PayNotes.payNote('Release Init Runtime')
      .currency('USD')
      .amountMinor(1700)
      .release()
      .requestOnInit()
      .done()
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(payNote),
      'release init paynote initialization failed',
    );

    const triggeredEventTypes = initialized.triggeredEvents.map(
      (triggeredEvent) => toOfficialJson(triggeredEvent).type as string,
    );
    expect(triggeredEventTypes).toContain(
      'PayNote/Reservation Release Requested',
    );
  });
});
