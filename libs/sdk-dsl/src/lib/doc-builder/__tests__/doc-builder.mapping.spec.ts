import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../doc-builder.js';
import { toOfficialYaml } from '../../core/serialization.js';
import { BasicBlueTypes } from '../../core/basic-blue-types.js';

describe('doc-builder mapping', () => {
  it('maps section, channel, field and operation contracts into deterministic YAML', () => {
    const document = DocBuilder.doc()
      .name('Counter')
      .description('Simple counter flow')
      .section('counterOps', 'Counter operations', 'Increment flow')
      .field('/counter', 0)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'increment',
        'ownerChannel',
        BasicBlueTypes.Integer,
        'Amount to increment',
        (steps) =>
          steps.replaceExpression(
            'IncrementCounter',
            '/counter',
            "document('/counter') + event.message.request",
          ),
      )
      .endSection()
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toBe(`name: Counter
description: Simple counter flow
contracts:
  ownerChannel:
    type: Conversation/Timeline Channel
    timelineId: owner-timeline
  increment:
    description: Amount to increment
    type: Conversation/Operation
    channel: ownerChannel
    request:
      type: Integer
  incrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: increment
    steps:
      - name: IncrementCounter
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: \${document('/counter') + event.message.request}
  counterOps:
    type: Conversation/Document Section
    title: Counter operations
    summary: Increment flow
    relatedFields:
      - /counter
    relatedContracts:
      - ownerChannel
      - increment
      - incrementImpl
counter: 0
`);
  });

  it('maps field metadata builder into object value shape', () => {
    const json = DocBuilder.doc()
      .name('Metadata')
      .field('/age')
      .type(BasicBlueTypes.Integer)
      .description('Age of customer')
      .minimum(0)
      .maximum(120)
      .value(30)
      .done()
      .buildJson();

    expect(json).toEqual({
      name: 'Metadata',
      age: {
        type: 'Integer',
        description: 'Age of customer',
        constraints: {
          minimum: 0,
          maximum: 120,
        },
        value: 30,
      },
    });
  });
});
