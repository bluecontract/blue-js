/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DslParityAssertions.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderSectionsDslParityTest.java
*/

import { BlueNode } from '@blue-labs/language';

import { DocBuilder } from '../lib';
import { getPointerNode } from '../lib/internal/pointer';
import { resolveTypeInput } from '../lib/internal/type-input';
import { toBlueNode } from '../lib/internal/value-to-node';
import { assertDslMatchesNode, assertDslMatchesYaml } from './dsl-parity';

describe('DocBuilder section parity', () => {
  it('tracks related fields and related contracts', () => {
    const fromDsl = DocBuilder.doc()
      .name('Counter')
      .section('participants', 'Participants', "Alice's timeline channel.")
      .channel('aliceTimeline')
      .endSection()
      .section(
        'counterOps',
        'Counter operations',
        'Counter with increment and decrement for Alice.',
      )
      .field('/counter', 0)
      .operation('increment')
      .channel('aliceTimeline')
      .requestType('Integer')
      .description('Increment the counter')
      .steps((steps) =>
        steps.replaceExpression(
          'Inc',
          '/counter',
          "event.message.request + document('/counter')",
        ),
      )
      .done()
      .operation('decrement')
      .channel('aliceTimeline')
      .requestType('Integer')
      .description('Decrement the counter')
      .steps((steps) =>
        steps.replaceExpression(
          'Dec',
          '/counter',
          "document('/counter') - event.message.request",
        ),
      )
      .done()
      .endSection()
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Counter
counter: 0
contracts:
  aliceTimeline:
    type: Core/Channel
  participants:
    type: Conversation/Document Section
    title: Participants
    summary: Alice's timeline channel.
    relatedContracts:
      - aliceTimeline
  increment:
    type: Conversation/Operation
    channel: aliceTimeline
    description: Increment the counter
    request:
      type: Integer
  incrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: increment
    steps:
      - name: Inc
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: "\${event.message.request + document('/counter')}"
  decrement:
    type: Conversation/Operation
    channel: aliceTimeline
    description: Decrement the counter
    request:
      type: Integer
  decrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: decrement
    steps:
      - name: Dec
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: "\${document('/counter') - event.message.request}"
  counterOps:
    type: Conversation/Document Section
    title: Counter operations
    summary: Counter with increment and decrement for Alice.
    relatedFields:
      - /counter
    relatedContracts:
      - increment
      - incrementImpl
      - decrement
      - decrementImpl
`,
    );
  });

  it('throws when buildDocument is called with an open section', () => {
    expect(() =>
      DocBuilder.doc()
        .name('Unclosed section')
        .section('s1', 'Section 1', 'Missing end')
        .channel('ownerChannel')
        .buildDocument(),
    ).toThrowError(
      "Unclosed section: 's1'. Call endSection() before buildDocument().",
    );
  });

  it('supports field builder value, type, description, constraints, object and BlueNode values', () => {
    const fromDsl = DocBuilder.doc()
      .name('Field builder parity')
      .field('/x')
      .type('Integer')
      .description('Score')
      .required(true)
      .minimum(0)
      .maximum(100)
      .value(42)
      .done()
      .field('/profile', {
        name: 'Alice',
        score: 7,
      })
      .field(
        '/meta',
        new BlueNode().addProperty('source', new BlueNode().setValue('manual')),
      )
      .field('/trackedOnly')
      .done()
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Field builder parity
x:
  type: Integer
  description: Score
  constraints:
    required: true
    minimum: 0
    maximum: 100
  value: 42
profile:
  name: Alice
  score: 7
meta:
  source: manual
`,
    );
    expect(getPointerNode(fromDsl, '/trackedOnly')).toBeNull();
  });

  it('tracks init lifecycle contracts when onInit is defined inside a section', () => {
    const fromDsl = DocBuilder.doc()
      .name('Sectioned init handler')
      .section('lifecycle', 'Lifecycle')
      .onInit('initialize', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'ready'),
      )
      .endSection()
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Sectioned init handler
contracts:
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  initialize:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - name: SetStatus
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: ready
  lifecycle:
    type: Conversation/Document Section
    title: Lifecycle
    relatedContracts:
      - initLifecycleChannel
      - initialize
`,
    );
  });

  it('tracks triggered event contracts when onEvent is defined inside a section', () => {
    const fromDsl = DocBuilder.doc()
      .name('Sectioned event handler')
      .section('events', 'Event handlers')
      .onEvent('onCompleted', 'Conversation/Status Completed', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'done'),
      )
      .endSection()
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Sectioned event handler
contracts:
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  onCompleted:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: Conversation/Status Completed
    steps:
      - name: SetStatus
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: done
  events:
    type: Conversation/Document Section
    title: Event handlers
    relatedContracts:
      - triggeredEventChannel
      - onCompleted
`,
    );
  });

  it('tracks triggered event contracts when onNamedEvent is defined inside a section', () => {
    const fromDsl = DocBuilder.doc()
      .name('Sectioned named-event handler')
      .section('events', 'Named event handlers')
      .onNamedEvent('onReady', 'READY', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'ready'),
      )
      .endSection()
      .buildDocument();

    const expected = new BlueNode().setName('Sectioned named-event handler');
    const contracts = new BlueNode();
    expected.addProperty('contracts', contracts);

    contracts.addProperty(
      'triggeredEventChannel',
      new BlueNode().setType(resolveTypeInput('Core/Triggered Event Channel')),
    );

    const workflow = new BlueNode().setType(
      resolveTypeInput('Conversation/Sequential Workflow'),
    );
    workflow.addProperty('channel', toBlueNode('triggeredEventChannel'));

    const event = new BlueNode().setType(
      resolveTypeInput('Common/Named Event'),
    );
    event.addProperty('name', toBlueNode('READY'));
    workflow.addProperty('event', event);

    const change = new BlueNode();
    change.addProperty('op', toBlueNode('replace'));
    change.addProperty('path', toBlueNode('/status'));
    change.addProperty('val', toBlueNode('ready'));

    const step = new BlueNode()
      .setName('SetStatus')
      .setType(resolveTypeInput('Conversation/Update Document'));
    step.addProperty('changeset', new BlueNode().setItems([change]));
    workflow.addProperty('steps', new BlueNode().setItems([step]));
    contracts.addProperty('onReady', workflow);

    const section = new BlueNode().setType(
      resolveTypeInput('Conversation/Document Section'),
    );
    section.addProperty('title', toBlueNode('Named event handlers'));
    section.addProperty(
      'relatedContracts',
      new BlueNode().setItems([
        toBlueNode('triggeredEventChannel'),
        toBlueNode('onReady'),
      ]),
    );
    contracts.addProperty('events', section);

    assertDslMatchesNode(fromDsl, expected);
  });
});
