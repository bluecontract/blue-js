import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
  makeTimelineEntryYaml,
} from '../test-support/runtime.js';

describe('sdk e2e: composite channel', () => {
  it('routes events from child channels through composite channel handler', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Composite e2e')
      .field('/hits', 0)
      .channel('payerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'payer-session',
      })
      .channel('payeeChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'payee-session',
      })
      .compositeChannel('participantsChannel', 'payerChannel', 'payeeChannel')
      .workflow('onParticipantEvent', {
        channel: 'participantsChannel',
        steps: [
          {
            name: 'IncrementHits',
            type: 'Conversation/Update Document',
            changeset: [
              { op: 'replace', path: '/hits', val: "${document('/hits') + 1}" },
            ],
          },
        ],
      })
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    const payerEvent = blue.yamlToNode(
      makeTimelineEntryYaml(
        'payer-session',
        `type: Conversation/Chat Message
message: payer-event`,
      ),
    );
    const payeeEvent = blue.yamlToNode(
      makeTimelineEntryYaml(
        'payee-session',
        `type: Conversation/Chat Message
message: payee-event`,
      ),
    );

    const afterPayer = await expectOk(
      processor.processDocument(initialized.document.clone(), payerEvent),
    );
    const afterPayee = await expectOk(
      processor.processDocument(afterPayer.document.clone(), payeeEvent),
    );

    expect(Number(afterPayee.document.get('/hits'))).toBe(2);
  });
});
