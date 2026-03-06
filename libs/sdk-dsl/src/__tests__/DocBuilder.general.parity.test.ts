/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DslParityAssertions.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java
*/

import { BlueNode } from '@blue-labs/language';

import { DocBuilder } from '../lib';
import { assertDslMatchesYaml } from './dsl-parity';

describe('DocBuilder general parity', () => {
  it('matches identity and string type YAML', () => {
    const fromDsl = DocBuilder.doc()
      .name('Identity parity')
      .description('Doc description')
      .type('Custom/Type')
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Identity parity
description: Doc description
type: Custom/Type
`,
    );
  });

  it('edit mutates the provided node', () => {
    const existing = new BlueNode().setName('Existing');

    const edited = DocBuilder.edit(existing)
      .field('/counter', 1)
      .buildDocument();

    expect(edited).toBe(existing);
    assertDslMatchesYaml(
      edited,
      `
name: Existing
counter: 1
`,
    );
  });

  it('from clones the provided node', () => {
    const existing = new BlueNode().setName('Existing');

    const cloned = DocBuilder.from(existing)
      .field('/counter', 1)
      .buildDocument();

    expect(cloned).not.toBe(existing);
    assertDslMatchesYaml(
      existing,
      `
name: Existing
`,
    );
    assertDslMatchesYaml(
      cloned,
      `
name: Existing
counter: 1
`,
    );
  });

  it('matches inline operation parity with request type', () => {
    const fromDsl = DocBuilder.doc()
      .name('Operation request parity')
      .channel('ownerChannel')
      .operation(
        'increment',
        'ownerChannel',
        'Integer',
        'Increment the counter',
        (steps) =>
          steps.replaceExpression(
            'ApplyIncrement',
            '/counter',
            "document('/counter') + event.message.request",
          ),
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Operation request parity
contracts:
  ownerChannel:
    type: Core/Channel
  increment:
    type: Conversation/Operation
    channel: ownerChannel
    description: Increment the counter
    request:
      type: Integer
  incrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: increment
    steps:
      - name: ApplyIncrement
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: "\${document('/counter') + event.message.request}"
`,
    );
  });

  it('matches inline operation parity without request type', () => {
    const fromDsl = DocBuilder.doc()
      .name('Operation parity')
      .channel('ownerChannel')
      .operation('ping', 'ownerChannel', 'Ping operation', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'ok'),
      )
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Operation parity
contracts:
  ownerChannel:
    type: Core/Channel
  ping:
    type: Conversation/Operation
    channel: ownerChannel
    description: Ping operation
  pingImpl:
    type: Conversation/Sequential Workflow Operation
    operation: ping
    steps:
      - name: SetStatus
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: ok
`,
    );
  });

  it('matches operation builder parity with no request', () => {
    const fromDsl = DocBuilder.doc()
      .name('Operation builder parity')
      .channel('ownerChannel')
      .operation('ack')
      .channel('ownerChannel')
      .description('Acknowledge')
      .noRequest()
      .steps((steps) => steps.replaceValue('SetAck', '/acknowledged', true))
      .done()
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Operation builder parity
contracts:
  ownerChannel:
    type: Core/Channel
  ack:
    type: Conversation/Operation
    channel: ownerChannel
    description: Acknowledge
  ackImpl:
    type: Conversation/Sequential Workflow Operation
    operation: ack
    steps:
      - name: SetAck
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /acknowledged
            val: true
`,
    );
  });

  it('matches operation builder request description parity', () => {
    const fromDsl = DocBuilder.doc()
      .name('Operation builder request description parity')
      .channel('ownerChannel')
      .operation('increment')
      .channel('ownerChannel')
      .description('Increment')
      .requestType('Integer')
      .requestDescription('Value to add')
      .steps((steps) =>
        steps.replaceExpression(
          'ApplyIncrement',
          '/counter',
          "document('/counter') + event.message.request",
        ),
      )
      .done()
      .buildDocument();

    assertDslMatchesYaml(
      fromDsl,
      `
name: Operation builder request description parity
contracts:
  ownerChannel:
    type: Core/Channel
  increment:
    type: Conversation/Operation
    channel: ownerChannel
    description: Increment
    request:
      type: Integer
      description: Value to add
  incrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: increment
    steps:
      - name: ApplyIncrement
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: "\${document('/counter') + event.message.request}"
`,
    );
  });
});
