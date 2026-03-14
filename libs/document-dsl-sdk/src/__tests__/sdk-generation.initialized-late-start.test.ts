import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import { expr } from '../expr.js';

describe('sdk generation: initialized marker and embedded updates', () => {
  it('tracks section fields/contracts and lifecycle/doc-update workflows', () => {
    const yaml = DocBuilder.doc()
      .name('Initialization and updates')
      .section('startupSection', 'Startup', 'Startup contracts')
      .field('/targetSessionId', 'session-42')
      .channel('ownerChannel')
      .operation('activate')
      .channel('ownerChannel')
      .steps((steps) =>
        steps
          .myOs()
          .subscribeToSession(
            'ownerChannel',
            expr("document('/targetSessionId')"),
            'SUB_1',
            [{ type: 'MyOS/Call Operation Responded' }],
          ),
      )
      .done()
      .endSection()
      .onInit('initialize', (steps) =>
        steps.replaceValue('SetReady', '/status', 'ready'),
      )
      .onDocChange('onStatusChanged', '/status', (steps) =>
        steps.namedEvent('EmitStatusChanged', 'STATUS_CHANGED'),
      )
      .toYaml();

    expect(yaml.trim()).toBe(
      `
name: Initialization and updates
targetSessionId: session-42
contracts:
  ownerChannel:
    type: Core/Channel
  activate:
    type: Conversation/Operation
    channel: ownerChannel
  activateImpl:
    type: Conversation/Sequential Workflow Operation
    operation: activate
    steps:
      - name: SubscribeToSession
        type: Conversation/Trigger Event
        event:
          type: MyOS/Subscribe to Session Requested
          onBehalfOf: ownerChannel
          targetSessionId: \${document('/targetSessionId')}
          subscription:
            id: SUB_1
            events:
              - type: MyOS/Call Operation Responded
  startupSection:
    type: Conversation/Document Section
    title: Startup
    summary: Startup contracts
    relatedFields:
      - /targetSessionId
    relatedContracts:
      - ownerChannel
      - activate
      - activateImpl
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  initialize:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - name: SetReady
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: ready
  onStatusChangedDocUpdateChannel:
    type: Core/Document Update Channel
    path: /status
  onStatusChanged:
    type: Conversation/Sequential Workflow
    channel: onStatusChangedDocUpdateChannel
    event:
      type: Core/Document Update
    steps:
      - name: EmitStatusChanged
        type: Conversation/Trigger Event
        event:
          type: Conversation/Event
          name: STATUS_CHANGED
`.trim(),
    );
  });
});
