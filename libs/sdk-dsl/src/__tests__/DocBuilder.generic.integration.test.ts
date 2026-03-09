/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java
*/

import { DocBuilder } from '../lib';
import {
  getStoredDocumentBlueId,
  initializeDocument,
  makeTimelineEntryEvent,
  processExternalEvent,
  processOperationRequest,
} from './processor-harness';

const TIMELINE_ID = 'timeline-generic-stage-b';

describe('DocBuilder generic integration', () => {
  it('executes repo-confirmed directChange workflows and updates the document', async () => {
    const built = DocBuilder.doc()
      .name('Change workflow doc')
      .field('/counter', 0)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: TIMELINE_ID,
      })
      .directChange('changeByAlice', 'ownerChannel', 'Apply patch')
      .buildDocument();

    const initialized = await initializeDocument(built, {
      resolveOperationContracts: true,
    });
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: TIMELINE_ID,
      operation: 'changeByAlice',
      request: {
        type: 'Conversation/Change Request',
        summary: 'Update counter',
        changeset: [
          {
            type: 'Core/Json Patch Entry',
            op: 'replace',
            path: '/counter',
            val: 7,
          },
        ],
      },
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(processed.document.getAsInteger('/counter')).toBe(7);
  });

  it('executes canEmit workflows and re-emits request payload events', async () => {
    const built = DocBuilder.doc()
      .name('CanEmit Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: TIMELINE_ID,
      })
      .canEmit('ownerChannel')
      .buildDocument();

    const initialized = await initializeDocument(built, {
      resolveOperationContracts: true,
    });
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: TIMELINE_ID,
      operation: 'ownerEmit',
      request: [
        {
          type: 'Conversation/Event',
          topic: 'runtime-can-emit',
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(processed.triggeredEvents).toHaveLength(1);
    expect(
      processed.triggeredEvents[0]?.getProperties()?.topic?.getValue(),
    ).toBe('runtime-can-emit');
  });

  it('executes requestless operation handlers with arbitrary payloads', async () => {
    const built = DocBuilder.doc()
      .name('Requestless operation runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: TIMELINE_ID,
      })
      .operation('ownerPing')
      .channel('ownerChannel')
      .description('Accept any payload and re-emit it.')
      .steps((steps) =>
        steps.emitType('EmitRequest', 'Conversation/Event', (payload) =>
          payload.putExpression('payload', 'event.message.request'),
        ),
      )
      .done()
      .buildDocument();

    const initialized = await initializeDocument(built, {
      resolveOperationContracts: true,
    });
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: TIMELINE_ID,
      operation: 'ownerPing',
      request: {
        type: 'Conversation/Event',
        marker: 'arbitrary',
        nested: {
          amount: 7,
        },
      },
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(processed.triggeredEvents).toHaveLength(1);
    expect(
      String(
        processed.triggeredEvents[0]
          ?.getProperties()
          ?.payload?.getProperties()
          ?.marker?.getValue(),
      ),
    ).toBe('arbitrary');
    expect(
      String(
        processed.triggeredEvents[0]
          ?.getProperties()
          ?.payload?.getProperties()
          ?.nested?.getProperties()
          ?.amount?.getValue(),
      ),
    ).toBe('7');
  });

  it('executes generic workflow helpers with full matcher objects on timeline channels', async () => {
    const built = DocBuilder.doc()
      .name('Generic workflow runtime')
      .field('/status', 'idle')
      .channel('auditChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: TIMELINE_ID,
      })
      .workflow('onApprovedMessage')
      .channel('auditChannel')
      .event({
        message: {
          type: 'Conversation/Chat Message',
          message: 'approved',
        },
      })
      .steps((steps) =>
        steps.replaceValue('MarkApproved', '/status', 'approved'),
      )
      .done()
      .buildDocument();

    const initialized = await initializeDocument(built);
    const processed = await processExternalEvent({
      processor: initialized.processor,
      document: initialized.document,
      event: makeTimelineEntryEvent(initialized.blue, {
        timelineId: TIMELINE_ID,
        message: {
          type: 'Conversation/Chat Message',
          message: 'approved',
        },
      }),
    });

    expect(String(processed.document.get('/status'))).toBe('approved');
  });
});
