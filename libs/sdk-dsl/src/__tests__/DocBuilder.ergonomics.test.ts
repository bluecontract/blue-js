import { BlueNode } from '@blue-labs/language';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import { DocBuilder, nodeToAliasJson, PayNotes } from '../lib';

describe('DocBuilder ergonomics helpers', () => {
  it('buildJson exports alias-style JSON for the materialized document shape', () => {
    const json = DocBuilder.doc()
      .name('Alias export')
      .type('Conversation/Event')
      .field('/age')
      .type('Integer')
      .description('Age in years')
      .value(30)
      .done()
      .buildJson();

    expect(json).toEqual({
      name: 'Alias export',
      type: 'Conversation/Event',
      age: 30,
    });
  });

  it('nodeToAliasJson normalizes nested type-carrying keys without touching arbitrary blueId payloads', () => {
    const node = DocBuilder.doc()
      .name('Nested aliases')
      .field('/schema', {
        type: { blueId: conversationBlueIds['Conversation/Event'] },
        itemType: { blueId: conversationBlueIds['Conversation/Request'] },
        metadata: {
          blueId: 'user-defined-blueid',
        },
      })
      .buildDocument();

    expect(nodeToAliasJson(node)).toEqual({
      name: 'Nested aliases',
      schema: {
        type: 'Conversation/Event',
        itemType: 'Conversation/Request',
        metadata: {
          blueId: 'user-defined-blueid',
        },
      },
    });
  });

  it('contract helper inserts a contract and tracks it in sections', () => {
    const json = DocBuilder.doc()
      .section('ops', 'Operations')
      .contract('auditChannel', {
        type: 'Core/Channel',
        description: 'Audit trail',
      })
      .endSection()
      .buildJson();

    expect(json.contracts).toMatchObject({
      auditChannel: {
        type: 'Core/Channel',
        description: 'Audit trail',
      },
      ops: {
        type: 'Conversation/Document Section',
        title: 'Operations',
        relatedContracts: ['auditChannel'],
      },
    });
  });

  it('contracts helper inserts multiple contracts deterministically', () => {
    const json = DocBuilder.doc()
      .contracts({
        ownerChannel: {
          type: 'Core/Channel',
        },
        auditChannel: {
          type: 'Core/Channel',
        },
      })
      .buildJson();

    expect(json.contracts).toEqual({
      ownerChannel: {
        type: 'Core/Channel',
      },
      auditChannel: {
        type: 'Core/Channel',
      },
    });
  });

  it('buildJson leaves the working node editable after export', () => {
    const builder = DocBuilder.doc().name('Editable').contract('channel', {
      type: 'Core/Channel',
    });

    const before = builder.buildJson();
    const after = builder.field('/status', 'ok').buildDocument();

    expect(before).toMatchObject({
      name: 'Editable',
      contracts: {
        channel: {
          type: 'Core/Channel',
        },
      },
    });
    expect(after).toBeInstanceOf(BlueNode);
    expect(nodeToAliasJson(after)).toMatchObject({
      name: 'Editable',
      status: 'ok',
    });
  });

  it('inherits buildJson on specialized builder surfaces', () => {
    const json = PayNotes.payNote('Invoice')
      .currency('USD')
      .amountMinor(1250)
      .buildJson();

    expect(json).toEqual({
      name: 'Invoice',
      type: 'PayNote/PayNote',
      currency: 'USD',
      amount: {
        total: 1250,
      },
    });
  });
});
