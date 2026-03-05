import { describe, expect, it } from 'vitest';
import { toOfficialYaml } from '../../core/serialization.js';
import { PayNotes } from '../paynotes.js';

describe('paynote mapping', () => {
  it('maps paynote defaults, amount, and capture workflows', () => {
    const payNote = PayNotes.payNote('Armchair')
      .description('Escrow paynote')
      .currency('USD')
      .amountMinor(10000)
      .capture()
      .lockOnInit()
      .requestOnInit()
      .done()
      .buildDocument();

    expect(toOfficialYaml(payNote)).toBe(`name: Armchair
description: Escrow paynote
type: PayNote/PayNote
contracts:
  payerChannel:
    type: Conversation/Timeline Channel
    timelineId: payer-timeline
  payeeChannel:
    type: Conversation/Timeline Channel
    timelineId: payee-timeline
  guarantorChannel:
    type: Conversation/Timeline Channel
    timelineId: guarantor-timeline
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  captureLockOnInit:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - name: Lock
        type: Conversation/Trigger Event
        event:
          type: PayNote/Card Transaction Capture Lock Requested
  captureRequestOnInit:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - name: Request
        type: Conversation/Trigger Event
        event:
          type: PayNote/Capture Funds Requested
          amount: \${document('/amount/total')}
currency: USD
amount:
  total: 10000
`);
  });

  it('maps reserve and release operation-triggered flows', () => {
    const payNote = PayNotes.payNote('Reserve/Release')
      .currency('USD')
      .amountMinor(2500)
      .reserve()
      .requestOnOperation(
        'requestReserve',
        'payerChannel',
        'Request reserve funds',
      )
      .done()
      .release()
      .requestOnOperation(
        'requestRelease',
        'guarantorChannel',
        'Request release flow',
      )
      .done()
      .buildDocument();

    const yaml = toOfficialYaml(payNote);
    expect(yaml).toContain(`requestReserve:
    description: Request reserve funds
    type: Conversation/Operation
    channel: payerChannel`);
    expect(yaml).toContain(`request:
      type: Integer`);
    expect(yaml).toContain(`requestReserveImpl:
    type: Conversation/Sequential Workflow Operation`);
    expect(yaml).toContain(`type: PayNote/Reserve Funds Requested`);
    expect(yaml).toContain(`requestRelease:
    description: Request release flow
    type: Conversation/Operation
    channel: guarantorChannel`);
    expect(yaml).toContain(`type: PayNote/Reservation Release Requested`);
  });

  it('maps capture unlock and partial-request operation helpers', () => {
    const payNote = PayNotes.payNote('Advanced Actions')
      .currency('USD')
      .amountMinor(1250)
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

    const yaml = toOfficialYaml(payNote);
    expect(yaml).toContain(`unlockCapture:
    description: Unlock capture
    type: Conversation/Operation
    channel: guarantorChannel`);
    expect(yaml).toContain(
      `type: PayNote/Card Transaction Capture Unlock Requested`,
    );
    expect(yaml).toContain(`capturePartial:
    description: Request partial capture
    type: Conversation/Operation
    channel: guarantorChannel`);
    expect(yaml).toContain(`request:
      type: Text`);
    expect(yaml).toContain(`amount: \${event.message.request}`);
  });

  it('maps capture unlock-on-event workflow helper', () => {
    const payNote = PayNotes.payNote('Capture Unlock On Event')
      .currency('USD')
      .amountMinor(3300)
      .capture()
      .unlockOnEvent('Conversation/Event')
      .done()
      .buildDocument();

    const yaml = toOfficialYaml(payNote);
    expect(yaml).toContain(`captureUnlockOnConversationEvent:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`event:
      type: Conversation/Event`);
    expect(yaml).toContain(
      `type: PayNote/Card Transaction Capture Unlock Requested`,
    );
  });
});
