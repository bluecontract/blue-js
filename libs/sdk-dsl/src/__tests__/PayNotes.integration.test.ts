/*
Java references:
- references/java-sdk/src/test/java/blue/language/samples/paynote/PayNoteCookbookExamples.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/PayNoteBuilderDslParityTest.java
*/

import { blueIds as payNoteBlueIds } from '@blue-repository/types/packages/paynote/blue-ids';

import { PayNotes } from '../lib';
import {
  getStoredDocumentBlueId,
  initializeDocument,
  processOperationRequest,
} from './processor-harness';

const PAYER_TIMELINE_ID = 'stage6-paynote-payer';
const GUARANTOR_TIMELINE_ID = 'stage6-paynote-guarantor';
const SHIPMENT_TIMELINE_ID = 'stage6-paynote-shipment';

describe('PayNotes integration', () => {
  it('emits capture lock on init, unlocks through an operation, and requests capture on demand', async () => {
    const built = PayNotes.payNote('Capture integration')
      .currency('USD')
      .amountMinor(2000)
      .channel('payerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: PAYER_TIMELINE_ID,
      })
      .capture()
      .lockOnInit()
      .unlockOnOperation(
        'unlockCapture',
        'payerChannel',
        'Unlock capture.',
        (steps) =>
          steps.replaceValue('MarkUnlocked', '/capture/unlockedByOp', true),
      )
      .requestOnOperation('requestCapture', 'payerChannel', 'Request capture.')
      .done()
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    expect(
      initialized.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          payNoteBlueIds['PayNote/Card Transaction Capture Lock Requested'],
      ),
    ).toBe(true);

    const unlocked = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: PAYER_TIMELINE_ID,
      operation: 'unlockCapture',
      request: true,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(unlocked.document.get('/capture/unlockedByOp'))).toBe('true');
    expect(
      unlocked.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          payNoteBlueIds['PayNote/Card Transaction Capture Unlock Requested'],
      ),
    ).toBe(true);

    const requested = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: unlocked.document,
      timelineId: PAYER_TIMELINE_ID,
      operation: 'requestCapture',
      request: true,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const captureRequest = requested.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        payNoteBlueIds['PayNote/Capture Funds Requested'],
    );
    expect(captureRequest).toBeDefined();
    expect(String(captureRequest?.getProperties()?.amount?.getValue())).toBe(
      '2000',
    );
  });

  it('runs capture request flows triggered by document updates', async () => {
    const built = PayNotes.payNote('Capture from document update')
      .currency('EUR')
      .amountMinor(49900)
      .channel('shipmentCompanyChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: SHIPMENT_TIMELINE_ID,
      })
      .operation('markDelivered')
      .channel('shipmentCompanyChannel')
      .description('Mark delivery confirmed')
      .requestType('Boolean')
      .steps((steps) =>
        steps.replaceValue(
          'WriteConfirmation',
          '/delivery/confirmedAt',
          '2026-01-01T12:00:00Z',
        ),
      )
      .done()
      .capture()
      .lockOnInit()
      .unlockOnDocPathChange('/delivery/confirmedAt')
      .requestOnDocPathChange('/delivery/confirmedAt')
      .done()
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    expect(
      initialized.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          payNoteBlueIds['PayNote/Card Transaction Capture Lock Requested'],
      ),
    ).toBe(true);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: SHIPMENT_TIMELINE_ID,
      operation: 'markDelivered',
      request: true,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(processed.document.get('/delivery/confirmedAt'))).toBe(
      '2026-01-01T12:00:00Z',
    );
    expect(
      processed.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          payNoteBlueIds['PayNote/Card Transaction Capture Unlock Requested'],
      ),
    ).toBe(true);
    expect(
      processed.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          payNoteBlueIds['PayNote/Capture Funds Requested'],
      ),
    ).toBe(true);
  });

  it('runs reserve and release request flows in the runtime-confirmed subset', async () => {
    const built = PayNotes.payNote('Reserve + release integration')
      .currency('USD')
      .amountMinor(75000)
      .channel('payerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: PAYER_TIMELINE_ID,
      })
      .channel('guarantorChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: GUARANTOR_TIMELINE_ID,
      })
      .reserve()
      .requestOnInit()
      .done()
      .release()
      .requestOnOperation(
        'openDispute',
        'payerChannel',
        'Open dispute for release.',
      )
      .done()
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    expect(
      initialized.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          payNoteBlueIds['PayNote/Reserve Funds Requested'],
      ),
    ).toBe(true);

    const disputed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: PAYER_TIMELINE_ID,
      operation: 'openDispute',
      request: true,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(
      disputed.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          payNoteBlueIds['PayNote/Reservation Release Requested'],
      ),
    ).toBe(true);
  });

  it('supports capture request flows triggered by emitted confirmation events', async () => {
    const built = PayNotes.payNote('Capture from emitted event')
      .currency('USD')
      .amountMinor(1800)
      .channel('payerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: PAYER_TIMELINE_ID,
      })
      .operation('emitCaptured')
      .channel('payerChannel')
      .description('Emit a capture confirmation')
      .requestType('Boolean')
      .steps((steps) =>
        steps.emitType('EmitCaptured', 'PayNote/Funds Captured', (payload) =>
          payload.put('amountCaptured', 1800),
        ),
      )
      .done()
      .capture()
      .requestOnEvent('PayNote/Funds Captured')
      .done()
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);
    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: PAYER_TIMELINE_ID,
      operation: 'emitCaptured',
      request: true,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(
      processed.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          payNoteBlueIds['PayNote/Capture Funds Requested'],
      ),
    ).toBe(true);
  });
});
