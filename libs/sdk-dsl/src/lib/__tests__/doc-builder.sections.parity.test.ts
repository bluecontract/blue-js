/**
 * Java reference:
 * - references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderSectionsDslParityTest.java
 */
import { BlueNode } from '@blue-labs/language';

import { DocBuilder } from '../../index.js';
import { assertDslMatchesYaml } from '../../__tests__/support/dsl-parity.js';

describe('DocBuilder sections parity', () => {
  it('tracks related fields and contracts', () => {
    const document = DocBuilder.doc()
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
      document,
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
            val: \${event.message.request + document('/counter')}
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
            val: \${document('/counter') - event.message.request}
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

  it('throws when a section is not closed', () => {
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

  it('supports field builder type description value constraints and node inputs', () => {
    const document = DocBuilder.doc()
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
      document,
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

    expect(() => document.getAsNode('/trackedOnly')).toThrow();
  });
});
