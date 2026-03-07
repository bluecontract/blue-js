/**
 * Java reference:
 * - references/java-sdk/src/test/java/blue/language/sdk/DocBuilderCounterIntegrationTest.java
 */
import { DocBuilder } from '../../index.js';
import { createProcessorHarness } from '../../__tests__/support/processor-harness.js';

describe('DocBuilder counter integration', () => {
  it('builds the counter document and processes an increment operation', async () => {
    const timelineId = 'owner-42';
    const { processor, createOperationRequestEvent } = createProcessorHarness();

    const document = DocBuilder.doc()
      .name('Counter')
      .field('/counter', 0)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId,
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
      .buildDocument();

    const initialized = await processor.initializeDocument(document.clone());
    expect(initialized.capabilityFailure).toBe(false);

    const processed = await processor.processDocument(
      initialized.document.clone(),
      createOperationRequestEvent(timelineId, 'increment', 10),
    );

    expect(processed.capabilityFailure).toBe(false);
    expect(
      String(processed.document.getProperties()?.counter?.getValue()),
    ).toBe('10');
  });
});
