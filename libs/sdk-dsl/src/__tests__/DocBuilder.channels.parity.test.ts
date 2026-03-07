/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DslParityAssertions.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java
*/

import { DocBuilder } from '../lib';
import { assertDslMatchesYaml } from './dsl-parity';

describe('DocBuilder channel parity', () => {
  it('matches default channel YAML', () => {
    const fromDsl = DocBuilder.doc()
      .name('Channel parity')
      .channel('ownerChannel')
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Channel parity
contracts:
  ownerChannel:
    type: Core/Channel
`,
    );
  });

  it('matches provided channel YAML', () => {
    const fromDsl = DocBuilder.doc()
      .name('Provided channel parity')
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'timeline-1',
        accountId: 'acc-1',
        email: 'owner@example.com',
      })
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Provided channel parity
contracts:
  ownerChannel:
    type: MyOS/MyOS Timeline Channel
    timelineId: timeline-1
    accountId: acc-1
    email: owner@example.com
`,
    );
  });

  it('matches channels(...) YAML', () => {
    const fromDsl = DocBuilder.doc()
      .name('Channels parity')
      .channels('nameA', 'nameB')
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Channels parity
contracts:
  nameA:
    type: Core/Channel
  nameB:
    type: Core/Channel
`,
    );
  });

  it('matches composite channel YAML', () => {
    const fromDsl = DocBuilder.doc()
      .name('Composite channel parity')
      .channels('payerChannel', 'payeeChannel')
      .compositeChannel(
        'participantUnionChannel',
        'payerChannel',
        'payeeChannel',
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Composite channel parity
contracts:
  payerChannel:
    type: Core/Channel
  payeeChannel:
    type: Core/Channel
  participantUnionChannel:
    type: Conversation/Composite Timeline Channel
    channels:
      - payerChannel
      - payeeChannel
`,
    );
  });

  it('specializes a template channel via from(existing)', () => {
    const template = DocBuilder.doc()
      .name('Channel template')
      .channel('adminChannel')
      .buildDocument();

    const specialized = DocBuilder.from(template)
      .channel('adminChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'session-42',
        accountId: 'acc-42',
        email: 'admin@company.com',
      })
      .buildDocument();

    expect(specialized).not.toBe(template);
    assertDslMatchesYaml(
      template,
      `
name: Channel template
contracts:
  adminChannel:
    type: Core/Channel
`,
    );
    assertDslMatchesYaml(
      specialized,
      `
name: Channel template
contracts:
  adminChannel:
    type: MyOS/MyOS Timeline Channel
    timelineId: session-42
    accountId: acc-42
    email: admin@company.com
`,
    );
  });

  it('matches onChannelEvent parity', () => {
    const fromDsl = DocBuilder.doc()
      .name('Channel event parity')
      .channel('ownerChannel')
      .field('/counter', 0)
      .onChannelEvent('onIncrementEvent', 'ownerChannel', 'Integer', (steps) =>
        steps.replaceValue('SetCounter', '/counter', 1),
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
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
