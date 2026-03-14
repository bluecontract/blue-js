import { withTypeBlueId } from '@blue-labs/language';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { BasicBlueTypes } from '../basic-blue-types.js';
import { DocBuilder } from '../builders/doc-builder.js';

describe('sdk generation: channels and operations', () => {
  it('generates deterministic yaml for channels + operation flows', () => {
    const documentYaml = DocBuilder.doc()
      .name('Channels and operations')
      .description('Parity for basic channel and operation creation.')
      .type(BasicBlueTypes.Dictionary)
      .field('/counter', 0)
      .channels('payerChannel', 'payeeChannel')
      .compositeChannel(
        'participantUnionChannel',
        'payerChannel',
        'payeeChannel',
      )
      .operation('increment')
      .channel('payerChannel')
      .description('Increment counter')
      .requestType(BasicBlueTypes.Integer)
      .requestDescription('The increment value')
      .steps((steps) =>
        steps.replaceExpression(
          'ApplyIncrement',
          '/counter',
          "document('/counter') + event.message.request",
        ),
      )
      .done()
      .toYaml();

    expect(documentYaml.trim()).toBe(
      `
name: Channels and operations
description: Parity for basic channel and operation creation.
type: Dictionary
counter: 0
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
  increment:
    type: Conversation/Operation
    channel: payerChannel
    description: Increment counter
    request:
      type: Integer
      description: The increment value
  incrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: increment
    steps:
      - name: ApplyIncrement
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: \${document('/counter') + event.message.request}
`.trim(),
    );
  });

  it('resolves zod type annotations in requestType', () => {
    const schema = withTypeBlueId('Zod-Type-Blue-Id')(z.object({}));

    const documentYaml = DocBuilder.doc()
      .name('Zod typed request')
      .channel('ownerChannel')
      .operation('emit')
      .channel('ownerChannel')
      .requestType(schema)
      .done()
      .toYaml();

    expect(documentYaml.trim()).toBe(
      `
name: Zod typed request
contracts:
  ownerChannel:
    type: Core/Channel
  emit:
    type: Conversation/Operation
    channel: ownerChannel
    request:
      type:
        blueId: Zod-Type-Blue-Id
`.trim(),
    );
  });
});
