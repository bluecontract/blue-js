import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  numericValue,
  property,
  propertyOptional,
} from '../../test-utils.js';

const blue = createBlue();
let testRunCounter = 0;

function nextTestRunId(prefix: string): string {
  testRunCounter += 1;
  return `${prefix}-${testRunCounter}`;
}

/**
 * Creates a unique timeline entry with a given value in the message.
 * The entryId is used as a fixed timestamp to ensure consistent canonical signatures
 * for deduplication testing.
 */
function makeTimelineEntryWithValue(
  timelineId: string,
  value: number,
  entryId: string,
) {
  // Use a hash of entryId as a stable timestamp for signature consistency
  const stableTimestamp = entryId
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 1700000000);
  const yaml = `type: Conversation/Timeline Entry
timeline:
  timelineId: ${timelineId}
message:
  type: Conversation/Chat Message
  message: "${value}"
actor:
  name: Timeline Driver
timestamp: ${stableTimestamp}
`;
  const entry = blue.yamlToNode(yaml);
  entry.setBlueId(entryId);
  return entry;
}

describe('Embedded — Shared timeline processing with checkpoints', () => {
  it('processes timeline entries by embedded documents, one with same timelineId as root document', async () => {
    const testRunId = nextTestRunId('test-processor');

    // Define timeline IDs (simulating 4 timelines)
    const timelineIds = [
      `${testRunId}-timeline-0`,
      `${testRunId}-timeline-1`,
      `${testRunId}-timeline-2`,
      `${testRunId}-timeline-3`,
    ];

    const processor = buildProcessor(blue);

    // Document structure matching the backend test:
    // - Root document has counter-1 (timeline1) and counter-3 (timeline3)
    // - emb1 has counter-0 (timeline0)
    // - emb2 has counter-1 (timeline1) and counter-2 (timeline2)
    // Note: timeline1 is shared between root and emb2
    const yaml = `name: ${testRunId}
counter-1: 0
counter-3: 0
emb1:
  name: ${testRunId}-emb-1
  counter-0: 0
  contracts:
    incrementChannel0:
      type: Conversation/Timeline Channel
      timelineId: ${timelineIds[0]}
    counterWorkflow:
      type: Conversation/Sequential Workflow
      channel: incrementChannel0
      steps:
        - name: Increment Counter
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /counter-0
              val: "\${document('counter-0') + parseInt(event.message.message)}"
emb2:
  name: ${testRunId}-emb-2
  counter-1: 0
  counter-2: 0
  contracts:
    incrementChannel1:
      type: Conversation/Timeline Channel
      timelineId: ${timelineIds[1]}
    incrementChannel2:
      type: Conversation/Timeline Channel
      timelineId: ${timelineIds[2]}
    counterWorkflow1:
      type: Conversation/Sequential Workflow
      channel: incrementChannel1
      steps:
        - name: Increment Counter
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /counter-1
              val: "\${document('counter-1') + parseInt(event.message.message)}"
    counterWorkflow2:
      type: Conversation/Sequential Workflow
      channel: incrementChannel2
      steps:
        - name: Increment Counter
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /counter-2
              val: "\${document('counter-2') + parseInt(event.message.message)}"
contracts:
  processEmbedded:
    type: Core/Process Embedded
    paths:
      - /emb1
      - /emb2
  incrementChannel1:
    type: Conversation/Timeline Channel
    timelineId: ${timelineIds[1]}
  incrementChannel3:
    type: Conversation/Timeline Channel
    timelineId: ${timelineIds[3]}
  counterWorkflow1:
    type: Conversation/Sequential Workflow
    channel: incrementChannel1
    steps:
      - name: Increment Counter
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /counter-1
            val: "\${document('counter-1') + parseInt(event.message.message)}"
  counterWorkflow2:
    type: Conversation/Sequential Workflow
    channel: incrementChannel3
    steps:
      - name: Increment Counter
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /counter-3
            val: "\${document('counter-3') + parseInt(event.message.message)}"
`;

    const initResult = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    let document = initResult.document;

    // Verify initial state
    expect(numericValue(property(document, 'counter-1'))).toBe(0);
    expect(numericValue(property(document, 'counter-3'))).toBe(0);
    expect(
      numericValue(property(property(document, 'emb1'), 'counter-0')),
    ).toBe(0);
    expect(
      numericValue(property(property(document, 'emb2'), 'counter-1')),
    ).toBe(0);
    expect(
      numericValue(property(property(document, 'emb2'), 'counter-2')),
    ).toBe(0);

    // Create 3 entries for each timeline with values that should sum up correctly
    // Timeline 0: value 1 (3 entries) => emb1/counter-0 = 1+1+1 = 3
    // Timeline 1: value 2 (3 entries) => root/counter-1 = 2+2+2 = 6, emb2/counter-1 = 2+2+2 = 6
    // Timeline 2: value 3 (3 entries) => emb2/counter-2 = 3+3+3 = 9
    // Timeline 3: value 4 (3 entries) => root/counter-3 = 4+4+4 = 12

    // Process timeline 0 events (value 1)
    for (let i = 0; i < 3; i++) {
      const entry = makeTimelineEntryWithValue(
        timelineIds[0],
        1,
        `timeline0-entry-${i}`,
      );
      const result = await expectOk(
        processor.processDocument(document.clone(), entry),
      );
      document = result.document;
    }

    // Process timeline 1 events (value 2) - shared between root and emb2
    for (let i = 0; i < 3; i++) {
      const entry = makeTimelineEntryWithValue(
        timelineIds[1],
        2,
        `timeline1-entry-${i}`,
      );
      const result = await expectOk(
        processor.processDocument(document.clone(), entry),
      );
      document = result.document;
    }

    // Process timeline 2 events (value 3)
    for (let i = 0; i < 3; i++) {
      const entry = makeTimelineEntryWithValue(
        timelineIds[2],
        3,
        `timeline2-entry-${i}`,
      );
      const result = await expectOk(
        processor.processDocument(document.clone(), entry),
      );
      document = result.document;
    }

    // Process timeline 3 events (value 4)
    for (let i = 0; i < 3; i++) {
      const entry = makeTimelineEntryWithValue(
        timelineIds[3],
        4,
        `timeline3-entry-${i}`,
      );
      const result = await expectOk(
        processor.processDocument(document.clone(), entry),
      );
      document = result.document;
    }

    // Verify final state after processing all events
    expect(numericValue(property(document, 'counter-1'))).toBe(6);
    expect(numericValue(property(document, 'counter-3'))).toBe(12);
    expect(
      numericValue(property(property(document, 'emb1'), 'counter-0')),
    ).toBe(3);
    expect(
      numericValue(property(property(document, 'emb2'), 'counter-1')),
    ).toBe(6);
    expect(
      numericValue(property(property(document, 'emb2'), 'counter-2')),
    ).toBe(9);
  });

  it('reprocesses events when checkpoint is removed from a channel', async () => {
    const testRunId = nextTestRunId('test-processor-checkpoint');
    const timelineId = `${testRunId}-timeline`;

    const processor = buildProcessor(blue);

    const yaml = `name: ${testRunId}
counter: 0
contracts:
  timelineChannel:
    type: Conversation/Timeline Channel
    timelineId: ${timelineId}
  counterWorkflow:
    type: Conversation/Sequential Workflow
    channel: timelineChannel
    steps:
      - name: Increment Counter
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /counter
            val: "\${document('counter') + 1}"
`;

    const initResult = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    let document = initResult.document;

    // Process 3 events
    for (let i = 0; i < 3; i++) {
      const entry = makeTimelineEntryWithValue(timelineId, 1, `entry-${i}`);
      const result = await expectOk(
        processor.processDocument(document.clone(), entry),
      );
      document = result.document;
    }

    expect(numericValue(property(document, 'counter'))).toBe(3);

    // Verify checkpoint exists
    const contracts = property(document, 'contracts');
    const checkpoint = property(contracts, 'checkpoint');
    const lastEvents = property(checkpoint, 'lastEvents');
    const storedEvent = propertyOptional(lastEvents, 'timelineChannel');
    expect(storedEvent).toBeDefined();

    // Now remove the checkpoint for the channel and reprocess the same events
    // The events should be processed again since the checkpoint was removed
    // Create a modified document where the checkpoint lastEvents is cleared
    const modifiedDocument = document.clone();
    const modifiedContracts = modifiedDocument.getProperties()?.contracts;
    const modifiedCheckpoint = modifiedContracts?.getProperties()?.checkpoint;
    if (modifiedCheckpoint) {
      const checkpointProps = { ...modifiedCheckpoint.getProperties() };
      checkpointProps['lastEvents'] = blue.jsonValueToNode({});
      checkpointProps['lastSignatures'] = blue.jsonValueToNode({});
      modifiedCheckpoint.setProperties(checkpointProps);
    }

    // Re-process the same events - they should be processed again
    let reprocessedDocument = modifiedDocument;
    for (let i = 0; i < 3; i++) {
      const entry = makeTimelineEntryWithValue(timelineId, 1, `entry-${i}`);
      const result = await expectOk(
        processor.processDocument(reprocessedDocument.clone(), entry),
      );
      reprocessedDocument = result.document;
    }

    // Counter should now be 6 (3 original + 3 reprocessed)
    expect(numericValue(property(reprocessedDocument, 'counter'))).toBe(6);
  });

  it('shared timeline skips duplicates independently in root and child scopes', async () => {
    const testRunId = nextTestRunId('test-scope-isolation');
    const sharedTimelineId = `${testRunId}-shared-timeline`;

    const processor = buildProcessor(blue);

    // Root and embedded both listen to the same timeline
    const yaml = `name: ${testRunId}
rootCounter: 0
child:
  childCounter: 0
  contracts:
    childChannel:
      type: Conversation/Timeline Channel
      timelineId: ${sharedTimelineId}
    childWorkflow:
      type: Conversation/Sequential Workflow
      channel: childChannel
      steps:
        - name: Increment Child Counter
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /childCounter
              val: "\${document('childCounter') + 1}"
contracts:
  processEmbedded:
    type: Core/Process Embedded
    paths:
      - /child
  rootChannel:
    type: Conversation/Timeline Channel
    timelineId: ${sharedTimelineId}
  rootWorkflow:
    type: Conversation/Sequential Workflow
    channel: rootChannel
    steps:
      - name: Increment Root Counter
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /rootCounter
            val: "\${document('rootCounter') + 1}"
`;

    const initResult = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    let document = initResult.document;

    // Process one event - both root and child should receive it
    const firstEntry = makeTimelineEntryWithValue(
      sharedTimelineId,
      1,
      `shared-entry-0`,
    );
    const afterFirst = await expectOk(
      processor.processDocument(document.clone(), firstEntry),
    );
    document = afterFirst.document;

    expect(numericValue(property(document, 'rootCounter'))).toBe(1);
    expect(
      numericValue(property(property(document, 'child'), 'childCounter')),
    ).toBe(1);

    // Verify both checkpoints have the signature stored
    const rootCheckpoint = document
      .getProperties()
      ?.contracts?.getProperties()
      ?.checkpoint?.getProperties()?.lastSignatures;
    expect(rootCheckpoint?.getProperties()?.rootChannel).toBeDefined();

    const childCheckpoint = document
      .getProperties()
      ?.child?.getProperties()
      ?.contracts?.getProperties()
      ?.checkpoint?.getProperties()?.lastSignatures;
    expect(childCheckpoint?.getProperties()?.childChannel).toBeDefined();

    // Re-process the SAME event - both should skip as duplicate
    const duplicateResult = await expectOk(
      processor.processDocument(document.clone(), firstEntry),
    );

    // Both counters should remain unchanged (duplicate skipped)
    expect(
      numericValue(property(duplicateResult.document, 'rootCounter')),
    ).toBe(1);
    expect(
      numericValue(
        property(property(duplicateResult.document, 'child'), 'childCounter'),
      ),
    ).toBe(1);

    // Process a NEW event - both should process it
    const secondEntry = makeTimelineEntryWithValue(
      sharedTimelineId,
      1,
      `shared-entry-1`,
    );
    const afterSecond = await expectOk(
      processor.processDocument(duplicateResult.document.clone(), secondEntry),
    );

    expect(numericValue(property(afterSecond.document, 'rootCounter'))).toBe(2);
    expect(
      numericValue(
        property(property(afterSecond.document, 'child'), 'childCounter'),
      ),
    ).toBe(2);
  });

  it('demonstrates checkpoint behavior with shared timelines (behavior documentation)', async () => {
    const testRunId = nextTestRunId('test-checkpoint-behavior');
    const sharedTimelineId = `${testRunId}-shared-timeline`;

    const processor = buildProcessor(blue);

    // Root and embedded both listen to the same timeline
    const yaml = `name: ${testRunId}
rootCounter: 0
child:
  childCounter: 0
  contracts:
    childChannel:
      type: Conversation/Timeline Channel
      timelineId: ${sharedTimelineId}
    childWorkflow:
      type: Conversation/Sequential Workflow
      channel: childChannel
      steps:
        - name: Increment Child Counter
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /childCounter
              val: "\${document('childCounter') + 1}"
contracts:
  processEmbedded:
    type: Core/Process Embedded
    paths:
      - /child
  rootChannel:
    type: Conversation/Timeline Channel
    timelineId: ${sharedTimelineId}
  rootWorkflow:
    type: Conversation/Sequential Workflow
    channel: rootChannel
    steps:
      - name: Increment Root Counter
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /rootCounter
            val: "\${document('rootCounter') + 1}"
`;

    const initResult = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    let document = initResult.document;

    // Process 3 events - both root and child should receive them
    for (let i = 0; i < 3; i++) {
      const entry = makeTimelineEntryWithValue(
        sharedTimelineId,
        1,
        `shared-entry-${i}`,
      );
      const result = await expectOk(
        processor.processDocument(document.clone(), entry),
      );
      document = result.document;
    }

    expect(numericValue(property(document, 'rootCounter'))).toBe(3);
    expect(
      numericValue(property(property(document, 'child'), 'childCounter')),
    ).toBe(3);

    // Clear ONLY the child's checkpoint
    const modifiedDocument = document.clone();
    const childNode = modifiedDocument.getProperties()?.child;
    const childContracts = childNode?.getProperties()?.contracts;
    const childCheckpoint = childContracts?.getProperties()?.checkpoint;
    if (childCheckpoint) {
      const checkpointProps = { ...childCheckpoint.getProperties() };
      checkpointProps['lastEvents'] = blue.jsonValueToNode({});
      checkpointProps['lastSignatures'] = blue.jsonValueToNode({});
      childCheckpoint.setProperties(checkpointProps);
    }

    // Verify root checkpoint is still intact, child is cleared
    const rootSigs = modifiedDocument
      .getProperties()
      ?.contracts?.getProperties()
      ?.checkpoint?.getProperties()
      ?.lastSignatures?.getProperties();
    const childSigs = modifiedDocument
      .getProperties()
      ?.child?.getProperties()
      ?.contracts?.getProperties()
      ?.checkpoint?.getProperties()
      ?.lastSignatures?.getProperties();

    expect(rootSigs?.rootChannel).toBeDefined();
    expect(childSigs?.childChannel).toBeUndefined();

    // Re-process the same events. Root should skip them while the child
    // replays because its checkpoint was cleared.

    let reprocessedDocument = modifiedDocument;
    for (let i = 0; i < 3; i++) {
      const entry = makeTimelineEntryWithValue(
        sharedTimelineId,
        1,
        `shared-entry-${i}`,
      );
      const result = await expectOk(
        processor.processDocument(reprocessedDocument.clone(), entry),
      );
      reprocessedDocument = result.document;
    }

    // Root remains unchanged because its checkpoint stayed intact; child replays.
    expect(numericValue(property(reprocessedDocument, 'rootCounter'))).toBe(3);
    expect(
      numericValue(
        property(property(reprocessedDocument, 'child'), 'childCounter'),
      ),
    ).toBe(6);
  });
});
