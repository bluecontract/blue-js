import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';

describe('sdk generation: myos admin and interactions', () => {
  it('generates myos admin operation and triggered-event handlers', () => {
    const yaml = DocBuilder.doc()
      .name('MyOS interactions')
      .myOsAdmin()
      .onMyOsResponse(
        'onSingleDocGranted',
        'MyOS/Single Document Permission Granted',
        'REQ_1',
        (steps) => steps.replaceValue('SetGranted', '/status', 'granted'),
      )
      .onSubscriptionUpdate(
        'onCatalogUpdate',
        'SUB_ACCESS',
        'MyOS/Call Operation Responded',
        (steps) => steps.replaceValue('SetUpdated', '/updated', true),
      )
      .toYaml();

    expect(yaml.trim()).toBe(
      `
name: MyOS interactions
contracts:
  myOsAdminChannel:
    type: MyOS/MyOS Timeline Channel
  myOsAdminUpdate:
    type: Conversation/Operation
    description: Main operation to handle user actions in timeline.
    channel: myOsAdminChannel
  myOsAdminUpdateImpl:
    type: Conversation/Sequential Workflow Operation
    operation: myOsAdminUpdate
    steps:
      - name: aggregateEventsFromMyOsRequest
        type: Conversation/JavaScript Code
        code: 'return { events: event.message.request };'
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  onSingleDocGranted:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Single Document Permission Granted
      requestId: REQ_1
      inResponseTo:
        requestId: REQ_1
    steps:
      - name: SetGranted
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: granted
  onCatalogUpdate:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Subscription Update
      subscriptionId: SUB_ACCESS
      update:
        type: MyOS/Call Operation Responded
    steps:
      - name: SetUpdated
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /updated
            val: true
`.trim(),
    );
  });
});
