/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderMyOsDslParityTest.java
*/

import { blueIds as myOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';

import { DocBuilder } from '../lib';
import { assertDslMatchesYaml } from './dsl-parity';

describe('DocBuilder MyOS parity', () => {
  it('matches myOsAdmin parity for non-admin documents', () => {
    const fromDsl = DocBuilder.doc()
      .name('MyOS admin parity')
      .myOsAdmin()
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: MyOS admin parity
contracts:
  myOsAdminChannel:
    type: MyOS/MyOS Timeline Channel
  myOsAdminUpdate:
    type: Conversation/Operation
    description: The standard, required operation for MyOS Admin to deliver events.
    channel: myOsAdminChannel
    request:
      type: List
  myOsAdminUpdateImpl:
    type: Conversation/Sequential Workflow Operation
    description: Implementation that re-emits the provided events
    operation: myOsAdminUpdate
    steps:
      - name: EmitAdminEvents
        type: Conversation/JavaScript Code
        code: "return { events: event.message.request };"
`,
    );
  });

  it('does not materialize inherited admin contracts on MyOS admin base documents', () => {
    const fromDsl = DocBuilder.doc()
      .name('Admin base parity')
      .type('MyOS/MyOS Admin Base')
      .myOsAdmin()
      .buildDocument();

    expect(fromDsl.getContracts()).toBeUndefined();
  });

  it('supports the myOsAdmin(channelKey) overload', () => {
    const fromDsl = DocBuilder.doc()
      .name('Custom admin channel parity')
      .myOsAdmin('customAdminChannel')
      .buildDocument();

    expect(
      fromDsl.getContracts()?.customAdminChannel?.getType()?.getBlueId(),
    ).toBe(myOsBlueIds['MyOS/MyOS Timeline Channel']);
    expect(
      fromDsl
        .getContracts()
        ?.myOsAdminUpdate?.getProperties()
        ?.channel?.getValue(),
    ).toBe('customAdminChannel');
  });

  it('matches onTriggeredWithId parity for subscription updates', () => {
    const fromDsl = DocBuilder.doc()
      .name('Triggered subscription parity')
      .onTriggeredWithId(
        'onSubscription',
        'MyOS/Subscription Update',
        'subscriptionId',
        'SUB_1',
        (steps) => steps.replaceValue('SetSubscription', '/subscription', true),
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Triggered subscription parity
contracts:
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  onSubscription:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Subscription Update
      subscriptionId: SUB_1
    steps:
      - name: SetSubscription
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /subscription
            val: true
`,
    );
  });

  it('matches onTriggeredWithMatcher parity with explicit correlation matcher payload', () => {
    const fromDsl = DocBuilder.doc()
      .name('Triggered matcher parity')
      .onTriggeredWithMatcher(
        'onCorrelation',
        'MyOS/Call Operation Responded',
        {
          inResponseTo: {
            incomingEvent: 'incoming-blue-id',
          },
        },
        (steps) =>
          steps.replaceValue('SetCorrelation', '/correlation', 'matched'),
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Triggered matcher parity
contracts:
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  onCorrelation:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Call Operation Responded
      inResponseTo:
        incomingEvent: incoming-blue-id
    steps:
      - name: SetCorrelation
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /correlation
            val: matched
`,
    );
  });

  it('matches onSubscriptionUpdate parity with update type filters', () => {
    const fromDsl = DocBuilder.doc()
      .name('Subscription update typed parity')
      .onSubscriptionUpdate(
        'onSub',
        'SUB_42',
        'MyOS/Session Epoch Advanced',
        (steps) => steps.replaceValue('SetValue', '/value', 42),
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Subscription update typed parity
contracts:
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  onSub:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Subscription Update
      subscriptionId: SUB_42
      update:
        type: MyOS/Session Epoch Advanced
    steps:
      - name: SetValue
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /value
            val: 42
`,
    );
  });

  it('matches onSubscriptionUpdate parity without update type filters', () => {
    const fromDsl = DocBuilder.doc()
      .name('Subscription update parity')
      .onSubscriptionUpdate('onSub', 'SUB_99', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'received'),
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Subscription update parity
contracts:
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  onSub:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Subscription Update
      subscriptionId: SUB_99
    steps:
      - name: SetStatus
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: received
`,
    );
  });

  it('matches onMyOsResponse parity with request correlation', () => {
    const fromDsl = DocBuilder.doc()
      .name('MyOS response parity')
      .onMyOsResponse(
        'onResponse',
        'MyOS/Call Operation Responded',
        'REQ_1',
        (steps) => steps.replaceValue('SetOk', '/ok', true),
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: MyOS response parity
contracts:
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  onResponse:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Call Operation Responded
      inResponseTo:
        requestId: REQ_1
    steps:
      - name: SetOk
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /ok
            val: true
`,
    );
  });

  it('matches onMyOsResponse parity without request correlation', () => {
    const fromDsl = DocBuilder.doc()
      .name('Any response parity')
      .onMyOsResponse(
        'onAnyResponse',
        'MyOS/Call Operation Responded',
        (steps) => steps.replaceValue('SetSeen', '/seen', true),
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Any response parity
contracts:
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  onAnyResponse:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Call Operation Responded
    steps:
      - name: SetSeen
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /seen
            val: true
`,
    );
  });
});
