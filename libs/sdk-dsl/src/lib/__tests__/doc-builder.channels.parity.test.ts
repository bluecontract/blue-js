/**
 * Java reference:
 * - references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java
 */
import { DocBuilder } from '../../index.js';
import { assertDslMatchesYaml } from '../test-support/dsl-parity.js';

describe('DocBuilder channels parity', () => {
  it('supports default channel parity', () => {
    const document = DocBuilder.doc()
      .name('Channel parity')
      .channel('ownerChannel')
      .buildDocument();

    assertDslMatchesYaml(
      document,
      `
name: Channel parity
contracts:
  ownerChannel:
    type: Core/Channel
`,
    );
  });

  it('supports provided channel parity', () => {
    const document = DocBuilder.doc()
      .name('Provided channel parity')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'timeline-1',
        accountId: 'acc-1',
        email: 'owner@example.com',
      })
      .buildDocument();

    assertDslMatchesYaml(
      document,
      `
name: Provided channel parity
contracts:
  ownerChannel:
    type: Conversation/Timeline Channel
    timelineId: timeline-1
    accountId: acc-1
    email: owner@example.com
`,
    );
  });

  it('supports channels variadic parity', () => {
    const document = DocBuilder.doc()
      .name('Channels parity')
      .channels('nameA', 'nameB')
      .buildDocument();

    assertDslMatchesYaml(
      document,
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

  it('supports composite channel parity', () => {
    const document = DocBuilder.doc()
      .name('Composite channel parity')
      .channels('payerChannel', 'payeeChannel')
      .compositeChannel(
        'participantUnionChannel',
        'payerChannel',
        'payeeChannel',
      )
      .buildDocument();

    assertDslMatchesYaml(
      document,
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

  it('supports specializing a template channel via from(existing)', () => {
    const template = DocBuilder.doc()
      .name('Channel template')
      .channel('adminChannel')
      .buildDocument();

    const specialized = DocBuilder.from(template)
      .channel('adminChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'session-42',
        accountId: 'acc-42',
        email: 'admin@company.com',
      })
      .buildDocument();

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
    type: Conversation/Timeline Channel
    timelineId: session-42
    accountId: acc-42
    email: admin@company.com
`,
    );
  });
});
