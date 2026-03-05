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
});
