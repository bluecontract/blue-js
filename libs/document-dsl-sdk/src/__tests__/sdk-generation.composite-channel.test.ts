import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';

describe('sdk generation: composite channel', () => {
  it('generates composite timeline channel workflow wiring', () => {
    const yaml = DocBuilder.doc()
      .name('Composite channel')
      .channels('payerChannel', 'payeeChannel')
      .compositeChannel('participantsChannel', 'payerChannel', 'payeeChannel')
      .workflow('onParticipantEvent', {
        channel: 'participantsChannel',
        steps: [
          {
            name: 'MarkSeen',
            type: 'Conversation/Update Document',
            changeset: [{ op: 'replace', path: '/seen', val: true }],
          },
        ],
      })
      .toYaml();

    expect(yaml.trim()).toBe(
      `
name: Composite channel
contracts:
  payerChannel:
    type: Core/Channel
  payeeChannel:
    type: Core/Channel
  participantsChannel:
    type: Conversation/Composite Timeline Channel
    channels:
      - payerChannel
      - payeeChannel
  onParticipantEvent:
    type: Conversation/Sequential Workflow
    channel: participantsChannel
    steps:
      - name: MarkSeen
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /seen
            val: true
`.trim(),
    );
  });
});
