/**
 * Java reference:
 * - references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java
 * - references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java
 */
import { BlueNode } from '@blue-labs/language';

import { DocBuilder } from '../../index.js';
import {
  assertDslMatchesNode,
  assertDslMatchesYaml,
} from '../../__tests__/support/dsl-parity.js';

describe('DocBuilder workflow parity', () => {
  it('matches onEvent parity', () => {
    const document = DocBuilder.doc()
      .name('On event parity')
      .onEvent('onNumber', 'Integer', (steps) =>
        steps.replaceValue('SetN', '/n', 1),
      )
      .buildDocument();

    assertDslMatchesYaml(
      document,
      `
name: On event parity
contracts:
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  onNumber:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: Integer
    steps:
      - name: SetN
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /n
            val: 1
`,
    );
  });

  it('matches onNamedEvent parity', () => {
    const document = DocBuilder.doc()
      .name('On named event parity')
      .onNamedEvent('onOrderReady', 'order-ready', (steps) =>
        steps.replaceValue('SetReady', '/status', 'ready'),
      )
      .buildDocument();

    const expected = new BlueNode()
      .setName('On named event parity')
      .setContracts({
        triggeredEventChannel: new BlueNode().setType(
          'Core/Triggered Event Channel',
        ),
        onOrderReady: new BlueNode()
          .setType('Conversation/Sequential Workflow')
          .addProperty(
            'channel',
            new BlueNode().setValue('triggeredEventChannel'),
          )
          .addProperty(
            'event',
            new BlueNode()
              .setType('Common/Named Event')
              .addProperty('name', new BlueNode().setValue('order-ready')),
          )
          .addProperty(
            'steps',
            new BlueNode().setItems([
              new BlueNode()
                .setName('SetReady')
                .setType('Conversation/Update Document')
                .addProperty(
                  'changeset',
                  new BlueNode().setItems([
                    new BlueNode().setProperties({
                      op: new BlueNode().setValue('replace'),
                      path: new BlueNode().setValue('/status'),
                      val: new BlueNode().setValue('ready'),
                    }),
                  ]),
                ),
            ]),
          ),
      });

    assertDslMatchesNode(document, expected);
  });

  it('matches onDocChange parity', () => {
    const document = DocBuilder.doc()
      .name('On doc change parity')
      .onDocChange('whenPriceChanges', '/price', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'updated'),
      )
      .buildDocument();

    assertDslMatchesYaml(
      document,
      `
name: On doc change parity
contracts:
  whenPriceChangesDocUpdateChannel:
    type: Core/Document Update Channel
    path: /price
  whenPriceChanges:
    type: Conversation/Sequential Workflow
    channel: whenPriceChangesDocUpdateChannel
    event:
      type: Core/Document Update
    steps:
      - name: SetStatus
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: updated
`,
    );
  });

  it('matches onInit parity', () => {
    const document = DocBuilder.doc()
      .name('On init parity')
      .onInit('initialize', (steps) =>
        steps.replaceValue('SetReady', '/status', 'ready'),
      )
      .buildDocument();

    assertDslMatchesYaml(
      document,
      `
name: On init parity
contracts:
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  initialize:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - name: SetReady
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: ready
`,
    );
  });

  it('matches onChannelEvent parity', () => {
    const document = DocBuilder.doc()
      .name('Channel event parity')
      .channel('ownerChannel')
      .field('/counter', 0)
      .onChannelEvent(
        'onIncrementEvent',
        'ownerChannel',
        'Integer',
        (steps) => steps.replaceValue('SetCounter', '/counter', 1),
      )
      .buildDocument();

    assertDslMatchesYaml(
      document,
      `
name: Channel event parity
counter: 0
contracts:
  ownerChannel:
    type: Core/Channel
  onIncrementEvent:
    type: Conversation/Sequential Workflow
    channel: ownerChannel
    event:
      type: Integer
    steps:
      - name: SetCounter
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: 1
`,
    );
  });
});
