import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import { expr } from '../expr.js';

describe('sdk generation: worker agency and llm provider pattern', () => {
  it('generates worker-agency permission and LLM-provider orchestration contracts', () => {
    const yaml = DocBuilder.doc()
      .name('Worker agency and llm')
      .channel('ownerChannel')
      .operation('startAgency')
      .channel('ownerChannel')
      .steps((steps) =>
        steps
          .myOs()
          .grantWorkerAgencyPermission(
            'ownerChannel',
            'REQ_WORKER_GRANT',
            expr("document('/targetSessionId')"),
            {
              allowedDocumentTypes: [
                { type: 'Conversation/Operation Request' },
              ],
              allowedOperations: ['propose', 'accept'],
            },
          )
          .myOs()
          .startWorkerSession('ownerChannel', {
            document: {
              name: 'Worker Session',
            },
            channelBindings: {
              ownerChannel: 'ownerChannel',
            },
          }),
      )
      .done()
      .contract('llmProvider', {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
        description: 'Proxy operation to selected LLM provider.',
        request: {
          type: 'Dictionary',
        },
      })
      .workflow('llmProviderImpl', {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'llmProvider',
        steps: [
          {
            name: 'ProxyProviderRequest',
            type: 'Conversation/JavaScript Code',
            code: 'return { events: [event.message.request] };',
          },
        ],
      })
      .toYaml();

    expect(yaml.trim()).toBe(
      `
name: Worker agency and llm
contracts:
  ownerChannel:
    type: Core/Channel
  startAgency:
    type: Conversation/Operation
    channel: ownerChannel
  startAgencyImpl:
    type: Conversation/Sequential Workflow Operation
    operation: startAgency
    steps:
      - name: GrantWorkerAgencyPermission
        type: Conversation/Trigger Event
        event:
          type: MyOS/Worker Agency Permission Grant Requested
          onBehalfOf: ownerChannel
          requestId: REQ_WORKER_GRANT
          targetSessionId: \${document('/targetSessionId')}
          allowedWorkerAgencyPermissions:
            allowedDocumentTypes:
              - type: Conversation/Operation Request
            allowedOperations:
              - propose
              - accept
      - name: StartWorkerSession
        type: Conversation/Trigger Event
        event:
          type: MyOS/Start Worker Session Requested
          onBehalfOf: ownerChannel
          config:
            document:
              name: Worker Session
            channelBindings:
              ownerChannel: ownerChannel
  llmProvider:
    type: Conversation/Operation
    channel: ownerChannel
    description: Proxy operation to selected LLM provider.
    request:
      type: Dictionary
  llmProviderImpl:
    type: Conversation/Sequential Workflow Operation
    operation: llmProvider
    steps:
      - name: ProxyProviderRequest
        type: Conversation/JavaScript Code
        code: 'return { events: [event.message.request] };'
`.trim(),
    );
  });
});
