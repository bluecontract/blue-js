/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/DocBuilderCounterIntegrationTest.java
*/

import { DocBuilder } from '../lib';
import { assertDslMatchesYaml } from './dsl-parity';
import {
  getStoredDocumentBlueId,
  initializeDocument,
  processOperationRequest,
} from './processor-harness';

const TIMELINE_ID = 'timeline-owner-42';

describe('DocBuilder counter integration', () => {
  it('builds the counter document and processes an increment request', async () => {
    const built = DocBuilder.doc()
      .name('Counter')
      .field('/counter', 0)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: TIMELINE_ID,
      })
      .operation('increment')
      .channel('ownerChannel')
      .description('Increment the counter by the given number')
      .requestType('Integer')
      .requestDescription(
        'Represents a value by which counter will be incremented',
      )
      .steps((steps) =>
        steps.replaceExpression(
          'IncrementCounter',
          '/counter',
          "event.message.request + document('/counter')",
        ),
      )
      .done()
      .operation('decrement')
      .channel('ownerChannel')
      .description('Decrement the counter by the given number')
      .requestType('Integer')
      .requestDescription('Value to subtract')
      .steps((steps) =>
        steps.replaceExpression(
          'DecrementCounter',
          '/counter',
          "document('/counter') - event.message.request",
        ),
      )
      .done()
      .buildDocument();

    assertDslMatchesYaml(
      built,
      `
name: Counter
counter: 0
contracts:
  ownerChannel:
    type: Conversation/Timeline Channel
    timelineId: ${TIMELINE_ID}
  increment:
    type: Conversation/Operation
    channel: ownerChannel
    description: Increment the counter by the given number
    request:
      type: Integer
      description: Represents a value by which counter will be incremented
  incrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: increment
    steps:
      - name: IncrementCounter
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: "\${event.message.request + document('/counter')}"
  decrement:
    type: Conversation/Operation
    channel: ownerChannel
    description: Decrement the counter by the given number
    request:
      type: Integer
      description: Value to subtract
  decrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: decrement
    steps:
      - name: DecrementCounter
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: "\${document('/counter') - event.message.request}"
`,
    );

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: TIMELINE_ID,
      operation: 'increment',
      request: 10,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(processed.document.getAsInteger('/counter')).toBe(10);
  });
});
