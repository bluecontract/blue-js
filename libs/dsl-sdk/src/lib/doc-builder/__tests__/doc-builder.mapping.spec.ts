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

  it('maps document anchors and link wrappers', () => {
    const document = DocBuilder.doc()
      .name('Anchors and Links')
      .documentAnchors(['anchorA'])
      .sessionLink('sessionLink', 'anchorA', 'SESSION_1')
      .buildDocument();

    expect(toOfficialYaml(document)).toBe(`name: Anchors and Links
contracts:
  anchors:
    type: MyOS/Document Anchors
    anchorA:
      type: MyOS/Document Anchor
  links:
    type: MyOS/Document Links
    sessionLink:
      type: MyOS/MyOS Session Link
      anchor: anchorA
      sessionId: SESSION_1
`);
  });

  it('maps onNamedEvent matcher to runtime-compatible Common/Named Event shape', () => {
    const document = DocBuilder.doc()
      .name('Named Event Mapping')
      .field('/handled', false)
      .onNamedEvent('handleStatus', 'status-ready', (steps) =>
        steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`handleStatus:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      name: status-ready
      type: Common/Named Event`);
  });

  it('keeps onChannelEvent direct for non-timeline channels', () => {
    const document = DocBuilder.doc()
      .name('Direct Channel Event Mapping')
      .field('/handled', false)
      .channel('webhookChannel')
      .onChannelEvent(
        'handleWebhook',
        'webhookChannel',
        BasicBlueTypes.Integer,
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`handleWebhook:
    type: Conversation/Sequential Workflow
    channel: webhookChannel
    event:
      type: Integer`);
  });

  it('wraps timeline onChannelEvent message-type matchers under event.message', () => {
    const document = DocBuilder.doc()
      .name('Timeline Channel Event Mapping')
      .field('/handled', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .onChannelEvent(
        'handleOwnerMessage',
        'ownerChannel',
        'Conversation/Chat Message',
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`handleOwnerMessage:
    type: Conversation/Sequential Workflow
    channel: ownerChannel
    event:
      message:
        type: Conversation/Chat Message`);
  });

  it('maps MyOS marker helper contracts', () => {
    const document = DocBuilder.doc()
      .name('MyOS Marker Helpers')
      .participantsOrchestration()
      .sessionInteraction()
      .workerAgency()
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`participantsOrchestration:
    type: MyOS/MyOS Participants Orchestration`);
    expect(yaml).toContain(`sessionInteraction:
    type: MyOS/MyOS Session Interaction`);
    expect(yaml).toContain(`workerAgency:
    type: MyOS/MyOS Worker Agency`);
  });
});
