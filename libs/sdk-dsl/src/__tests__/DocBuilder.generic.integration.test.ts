/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java
*/

import { DocBuilder } from '../lib';
import {
  getStoredDocumentBlueId,
  initializeDocument,
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

    const initialized = await initializeDocument(built);
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

    const initialized = await initializeDocument(built);
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
});
